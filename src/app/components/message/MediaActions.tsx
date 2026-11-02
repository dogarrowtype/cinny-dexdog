import React, { RefObject, useRef, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, as, config } from 'folds';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../utils/matrix';
import { MediaEventContent, saveMatrixMedia } from '../../utils/saneDownload';
import { markDownloaded, wasDownloaded } from '../../utils/downloadMemory';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { swoopToButton } from './swoop';
import { FALLBACK_MIMETYPE } from '../../utils/mimeTypes';

type ActionState = 'idle' | 'loading' | 'ok' | 'err';

/**
 * Download + Copy buttons rendered under a media attachment, ported from
 * cinny-sane-downloader. The download resolves a sane filename, marks the
 * event in download memory and can trigger the swoop animation; the copy
 * button re-encodes non-PNG images through a canvas because the asynchronous
 * clipboard only accepts image/png.
 */
export type MediaActionsProps = {
  mEventId?: string;
  content: MediaEventContent;
  mxcUrl: string;
  mimeType: string;
  encInfo?: EncryptedAttachmentInfo;
  altText?: string;
  /** The media frame; the poster/blur image inside it is used for the swoop. */
  mediaRef?: RefObject<HTMLElement>;
  copyable?: boolean;
};

export const MediaActions = as<'div', MediaActionsProps>(
  (
    {
      mEventId,
      content,
      mxcUrl,
      mimeType,
      encInfo,
      altText,
      mediaRef,
      copyable,
      className,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [saneFilenames] = useSetting(settingsAtom, 'enhSaneFilenames');
    const [maxBaseName] = useSetting(settingsAtom, 'enhMaxBaseName');
    const [rememberDownloads] = useSetting(settingsAtom, 'enhRememberDownloads');
    const [memoryDays] = useSetting(settingsAtom, 'enhDownloadMemoryDays');
    const [swoop] = useSetting(settingsAtom, 'enhSwoop');
    const [swoopStyle] = useSetting(settingsAtom, 'enhSwoopStyle');
    const [swoopHold] = useSetting(settingsAtom, 'enhSwoopHold');
    const [swoopFlightSpeed] = useSetting(settingsAtom, 'enhSwoopFlightSpeed');
    const [swoopSpeed] = useSetting(settingsAtom, 'enhSwoopSpeed');
    const [swoopSize] = useSetting(settingsAtom, 'enhSwoopSize');
    const [showCopyButton] = useSetting(settingsAtom, 'enhShowCopyButton');

    const downloadBtnRef = useRef<HTMLButtonElement>(null);
    const [dlState, setDlState] = useState<ActionState>('idle');
    const [cpState, setCpState] = useState<ActionState>('idle');
    const [downloaded, setDownloaded] = useState(
      () => rememberDownloads && wasDownloaded(mEventId, memoryDays)
    );

    const fallbackName = () => {
      if (typeof content.filename === 'string' && content.filename.trim())
        return content.filename.trim();
      if (typeof content.body === 'string' && content.body.trim()) return content.body.trim();
      return altText || 'File';
    };

    const handleDownload = async (evt: React.MouseEvent) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (dlState === 'loading') return;
      setDlState('loading');
      try {
        await saveMatrixMedia({
          mx,
          src: mxcUrl,
          mimeType,
          encInfo,
          content,
          altText,
          eventId: mEventId,
          useAuthentication,
          maxBaseName,
          fallbackName: saneFilenames ? undefined : fallbackName(),
        });
        if (rememberDownloads) {
          markDownloaded(mEventId, memoryDays);
          setDownloaded(true);
        }
        if (swoop && mediaRef?.current && downloadBtnRef.current) {
          swoopToButton(mediaRef.current, downloadBtnRef.current, {
            style: swoopStyle,
            hold: swoopHold,
            flightSpeed: swoopFlightSpeed,
            speed: swoopSpeed,
            size: swoopSize,
          });
        }
        setDlState('ok');
        setTimeout(() => setDlState('idle'), 1500);
      } catch {
        setDlState('err');
        setTimeout(() => setDlState('idle'), 2500);
      }
    };

    const handleCopy = (evt: React.MouseEvent) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (cpState === 'loading') return;
      setCpState('loading');
      // ClipboardItem must be constructed synchronously inside the click
      // handler to keep the user activation; the fetch/re-encode runs inside
      // the promise handed to it. Chrome only accepts image/png here.
      const pngPromise = (async (): Promise<Blob> => {
        const mediaUrl = mxcUrlToHttp(mx, mxcUrl, useAuthentication);
        if (!mediaUrl) throw new Error('Invalid media URL');
        const blob = encInfo
          ? await downloadEncryptedMedia(mediaUrl, (encBuf) =>
              decryptFile(encBuf, mimeType || FALLBACK_MIMETYPE, encInfo)
            )
          : await downloadMedia(mediaUrl);
        if (blob.type === 'image/png') return blob;
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');
        ctx.drawImage(bitmap, 0, 0);
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))),
            'image/png'
          );
        });
      })();
      try {
        const item = new ClipboardItem({ 'image/png': pngPromise });
        navigator.clipboard
          .write([item])
          .then(() => {
            setCpState('ok');
            setTimeout(() => setCpState('idle'), 1500);
          })
          .catch(() => {
            setCpState('err');
            setTimeout(() => setCpState('idle'), 2500);
          });
      } catch {
        setCpState('err');
        setTimeout(() => setCpState('idle'), 2500);
      }
    };

    let downloadVariant: 'Secondary' | 'Success' | 'Critical' = 'Secondary';
    if (dlState === 'err') downloadVariant = 'Critical';
    else if (downloaded) downloadVariant = 'Success';

    return (
      <Box
        alignItems="Center"
        gap="200"
        style={{ marginTop: config.space.S200 }}
        className={className}
        {...props}
        ref={ref}
      >
        <Button
          ref={downloadBtnRef}
          size="300"
          variant={downloadVariant}
          fill="Soft"
          radii="300"
          disabled={dlState === 'loading'}
          onClick={handleDownload}
          before={
            dlState === 'loading' ? (
              <Spinner fill="Soft" size="50" variant="Secondary" />
            ) : (
              <Icon size="50" src={dlState === 'ok' || downloaded ? Icons.Check : Icons.Download} />
            )
          }
        >
          <Text size="B300">{dlState === 'ok' ? 'Saved' : 'Download'}</Text>
        </Button>
        {copyable && showCopyButton && (
          <Button
            size="300"
            variant={cpState === 'err' ? 'Critical' : 'Secondary'}
            fill="Soft"
            radii="300"
            disabled={cpState === 'loading'}
            onClick={handleCopy}
            before={cpState === 'ok' ? <Icon size="50" src={Icons.Check} /> : undefined}
          >
            <Text size="B300">{cpState === 'ok' ? 'Copied' : 'Copy'}</Text>
          </Button>
        )}
      </Box>
    );
  }
);
