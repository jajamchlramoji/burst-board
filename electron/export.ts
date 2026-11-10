import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ExportResult } from '../shared/api';
import type { AppState } from '../shared/types';
import { buildMarkdown } from '../shared/markdown';

export { buildMarkdown };

export async function exportMarkdown(state: AppState): Promise<ExportResult> {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const result = await dialog.showSaveDialog({
      title: 'Export ship log',
      defaultPath: path.join(app.getPath('downloads'), `ship-log-${stamp}.md`),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    // A read-only folder or a full disk used to throw here and the UI said
    // nothing at all, so the export looked like it had worked.
    fs.writeFileSync(result.filePath, buildMarkdown(state), 'utf8');
    return { ok: true, path: result.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[burst-board] export failed:', err);
    return { ok: false, error };
  }
}
