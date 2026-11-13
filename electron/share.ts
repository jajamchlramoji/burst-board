import { ClipboardItem, app, clipboard, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ExportResult } from '../shared/api';

const PREFIX = 'data:image/png;base64,';
const MAX_LENGTH = 20 * 1024 * 1024;

/** The share card arrives from the renderer as a PNG data URL; take nothing else. */
function pngFrom(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIX) || dataUrl.length > MAX_LENGTH) {
    return null;
  }
  const buf = Buffer.from(dataUrl.slice(PREFIX.length), 'base64');
  // PNG signature.
  return buf.subarray(0, 4).toString('hex') === '89504e47' ? buf : null;
}

export async function copyCard(dataUrl: unknown): Promise<boolean> {
  const png = pngFrom(dataUrl);
  if (!png) return false;
  try {
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
    return true;
  } catch (err) {
    console.error('[burst-board] could not copy the share image:', err);
    return false;
  }
}

export async function saveCard(dataUrl: unknown, name: unknown): Promise<ExportResult> {
  const png = pngFrom(dataUrl);
  if (!png) return { ok: false, error: 'That image could not be read.' };
  const base =
    (typeof name === 'string' ? name : 'ship')
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .slice(0, 60) || 'ship';
  try {
    const result = await dialog.showSaveDialog({
      title: 'Save share image',
      defaultPath: path.join(app.getPath('downloads'), `${base}.png`),
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(result.filePath, png);
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
