import { MatrixClient } from 'matrix-js-sdk';
import FileSaver from 'file-saver';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { decryptFile, downloadEncryptedMedia, downloadMedia, mxcUrlToHttp } from './matrix';
import { FALLBACK_MIMETYPE } from './mimeTypes';

/*
 * Sane download filenames, ported from cinny-sane-downloader's FILENAME
 * PLUMBING section. The real filename is usually in the event one field over:
 * Matrix 1.10 (MSC2530) split caption from filename, so `body` is the caption
 * and `filename` is the name the uploader actually gave the file. Whatever the
 * name ends up being, the extension is decided by the bytes.
 */

export const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/tiff': 'tif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
};

// Windows reserved device names. "CON.png" is not a legal file.
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Read the real container format out of the first bytes. More trustworthy than
 * any header or filename, and free - we are already holding the blob.
 */
export function sniffExtension(b: Uint8Array): string | null {
  const ascii = (o: number, s: string) =>
    s.split('').every((c, i) => b[o + i] === c.charCodeAt(0));

  if (b[0] === 0x89 && ascii(1, 'PNG')) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (ascii(0, 'GIF8')) return 'gif';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (brand === 'qt  ') return 'mov';
    return 'mp4';
  }
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (ascii(0, '%PDF')) return 'pdf';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  if (ascii(0, 'OggS')) return 'ogg';
  if (ascii(0, 'ID3')) return 'mp3';
  return null;
}

/** Does this string look like a filename rather than a paragraph? */
export function looksLikeFilename(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t.length > 0 && t.length <= 128 && !/[\r\n\t]/.test(t) && /\.[A-Za-z0-9]{1,5}$/.test(t);
}

/** Make a string safe as a single Windows path component. */
export function sanitizeBase(name: string, maxBaseName: number): string {
  let s = String(name)
    // Control characters become spaces so the next rule turns them into a
    // separator rather than gluing two words together.
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // eslint-disable-line no-control-regex
    // Illegal in a Windows filename. Hyphens and commas are fine, leave them.
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    // A run of periods is what makes the browser guess a giant extension.
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_')
    .trim();

  const max = Math.max(8, Number(maxBaseName) || 96);
  if (s.length > max) s = s.slice(0, max);

  // Windows silently drops trailing dots and spaces, so drop them ourselves
  // and keep the name we show equal to the name that lands on disk.
  s = s.replace(/[. _]+$/, '');

  if (!s || RESERVED.test(s)) s = `_${s}`;
  return s;
}

/** Split a candidate filename into { base, ext }; ext may be ''. */
export function splitName(name: string): { base: string; ext: string } {
  const t = String(name).trim();
  const m = /^(.*)\.([A-Za-z0-9]{1,5})$/.exec(t);
  return m ? { base: m[1], ext: m[2].toLowerCase() } : { base: t, ext: '' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Last resort name: cinny_20260905-184301_hIIUljk */
export function generatedBase(ts?: number, eventId?: string): string {
  const d = typeof ts === 'number' && !Number.isNaN(ts) ? new Date(ts) : new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const tail = String(eventId ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 7);
  return `cinny_${stamp}${tail ? `_${tail}` : ''}`;
}

export type MediaEventContent = {
  filename?: unknown;
  body?: unknown;
  info?: { mimetype?: unknown };
};

export type ResolveFilenameOptions = {
  altText?: string;
  ts?: number;
  eventId?: string;
  headBytes?: Uint8Array;
  blobType?: string;
  maxBaseName?: number;
};

/**
 * Pick the filename, most trustworthy source first:
 *   1. content.filename - what the uploader actually named the file
 *   2. content.body     - only when it still looks like a filename
 *   3. img alt / title  - same test, for when the content is thin
 *   4. generated        - timestamp + event id
 * Whatever we land on, the extension is decided by the bytes.
 */
export function resolveFilename(
  content: MediaEventContent | undefined,
  options: ResolveFilenameOptions
): string {
  const c = content ?? {};
  const maxBaseName = options.maxBaseName ?? 96;
  let candidate: string | null = null;

  if (looksLikeFilename(c.filename)) {
    candidate = c.filename;
  } else if (typeof c.filename === 'string' && c.filename.trim()) {
    // Present but odd - no extension, or overlong. Still beats the caption.
    candidate = c.filename.trim();
  } else if (looksLikeFilename(c.body)) {
    candidate = c.body;
  } else if (looksLikeFilename(options.altText)) {
    candidate = options.altText;
  }

  let base: string;
  let ext = '';
  if (candidate) {
    const parts = splitName(candidate);
    base = parts.base;
    ext = parts.ext;
  } else {
    base = generatedBase(options.ts, options.eventId);
  }

  base = sanitizeBase(base, maxBaseName);
  if (!base || base === '_') base = generatedBase(options.ts, options.eventId);

  // The bytes get the final say on what this file actually is.
  const sniffed = options.headBytes ? sniffExtension(options.headBytes) : null;
  const byMime =
    EXT_BY_MIME[String(options.blobType ?? '').toLowerCase()] ||
    EXT_BY_MIME[String(c.info?.mimetype ?? '').toLowerCase()];

  const finalExt = sniffed || byMime || ext || 'png';
  return `${base}.${finalExt}`;
}

export type SaveMatrixMediaOptions = {
  mx: MatrixClient;
  /**
   * Where to fetch from: an mxc:// URL resolved through the homeserver, or an
   * already-resolved http(s)/blob URL (e.g. a decrypted object URL).
   */
  src: string;
  mimeType?: string;
  encInfo?: EncryptedAttachmentInfo;
  content?: MediaEventContent;
  altText?: string;
  ts?: number;
  eventId?: string;
  useAuthentication?: boolean;
  maxBaseName?: number;
  /**
   * When provided, save with this name verbatim instead of resolving one
   * (used when the sane-filenames feature is switched off).
   */
  fallbackName?: string;
};

/**
 * Fetch the media (decrypting when needed) and save it with a sane filename.
 * Returns the resolved filename; the caller still owns download memory and
 * any animation.
 */
export async function saveMatrixMedia(options: SaveMatrixMediaOptions): Promise<string> {
  const { mx, src, mimeType, encInfo, content, altText, ts, eventId, useAuthentication } = options;
  let mediaUrl = src;
  if (src.startsWith('mxc://')) {
    const resolved = mxcUrlToHttp(mx, src, useAuthentication);
    if (!resolved) throw new Error('Invalid media URL');
    mediaUrl = resolved;
  }

  const fileContent = encInfo
    ? await downloadEncryptedMedia(mediaUrl, (encBuf) =>
        decryptFile(encBuf, mimeType ?? FALLBACK_MIMETYPE, encInfo)
      )
    : await downloadMedia(mediaUrl);

  const headBytes = new Uint8Array(await fileContent.slice(0, 16).arrayBuffer());
  const filename =
    options.fallbackName ??
    resolveFilename(content, {
      altText,
      ts,
      eventId,
      headBytes,
      blobType: fileContent.type,
      maxBaseName: options.maxBaseName,
    });
  FileSaver.saveAs(fileContent, filename);
  return filename;
}
