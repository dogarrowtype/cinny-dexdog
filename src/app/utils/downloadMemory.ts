/*
 * Download memory: which attachments have already been saved, keyed by event
 * id so it survives reloads and follows you between rooms. Ported from
 * cinny-sane-downloader's DOWNLOAD MEMORY section. Lives outside the settings
 * atom because it is plain text and capped anyway, oldest dropped first.
 */

const DOWNLOADS_KEY = 'cinny-enh:downloaded';
const DOWNLOADS_MAX = 4000;
let downloadLog: Map<string, number> | null = null;

function loadDownloadLog(): Map<string, number> {
  if (downloadLog) return downloadLog;
  downloadLog = new Map();
  try {
    const raw = localStorage.getItem(DOWNLOADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([id, ts]) => downloadLog?.set(id, Number(ts) || 0));
      }
    }
  } catch {
    // could not read the download log; start fresh
  }
  return downloadLog;
}

function saveDownloadLog(days: number) {
  if (!downloadLog) return;
  try {
    const safeDays = Math.max(0, Number(days) || 0);
    const cutoff = safeDays > 0 ? Date.now() - safeDays * 86400000 : 0;
    let entries = [...downloadLog.entries()];
    if (cutoff) entries = entries.filter(([, ts]) => ts >= cutoff);
    entries.sort((a, b) => b[1] - a[1]);
    if (entries.length > DOWNLOADS_MAX) entries = entries.slice(0, DOWNLOADS_MAX);
    downloadLog = new Map(entries);
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // could not save the download log
  }
}

export function wasDownloaded(eventId: string | undefined, days: number): boolean {
  if (!eventId) return false;
  const log = loadDownloadLog();
  const ts = log.get(eventId);
  if (!ts) return false;
  const safeDays = Math.max(0, Number(days) || 0);
  if (safeDays > 0 && ts < Date.now() - safeDays * 86400000) return false;
  return true;
}

export function markDownloaded(eventId: string | undefined, days: number): void {
  if (!eventId) return;
  loadDownloadLog().set(eventId, Date.now());
  saveDownloadLog(days);
}

export function getDownloadLogCount(): number {
  return loadDownloadLog().size;
}

export function clearDownloadLog(): void {
  downloadLog = new Map();
  try {
    localStorage.removeItem(DOWNLOADS_KEY);
  } catch {
    // best effort
  }
}
