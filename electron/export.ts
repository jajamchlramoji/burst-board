import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Ship } from '../shared/types';
import { WHERE_LABELS } from '../shared/types';
import { burstDayCount, shipStreak, shipsThisMonth } from '../shared/burst';

function day(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function buildMarkdown(state: AppState): string {
  const shipped: Ship[] = state.ships
    .filter((s) => s.status === 'shipped' && s.shippedAt)
    .sort((a, b) => (b.shippedAt! > a.shippedAt! ? 1 : -1));

  const streak = shipStreak(state.history);
  const lines: string[] = [];

  lines.push('# Ship log');
  lines.push('');
  lines.push(
    `**${shipped.length} ${shipped.length === 1 ? 'ship' : 'ships'}** · ` +
      `**${shipsThisMonth(state.ships)} this month** · ` +
      `**${streak}-burst-day ship streak** · ` +
      `${burstDayCount(state.history)} burst ${burstDayCount(state.history) === 1 ? 'day' : 'days'}`,
  );
  lines.push('');
  lines.push('_Every one of these went public inside a single burst._');
  lines.push('');

  if (shipped.length === 0) {
    lines.push('Nothing shipped yet.');
  }

  for (const s of shipped) {
    lines.push('---');
    lines.push('');
    lines.push(`## ${s.title}`);
    lines.push('');
    lines.push(
      `*${day(s.shippedAt!)} · ${WHERE_LABELS[s.where]}${
        s.where === 'other' && s.whereOther ? `: ${s.whereOther}` : ''
      }*`,
    );
    lines.push('');
    if (s.liveIn2h) {
      lines.push(`${s.liveIn2h}`);
      lines.push('');
    }
    for (const u of s.urls) lines.push(`- ${u}`);
    if (s.urls.length) lines.push('');
    if (s.win) {
      lines.push(`**Win:** ${s.win}`);
      lines.push('');
    }
    if (s.v2) {
      lines.push(`**Possible v2:** ${s.v2}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('<sub>Exported from Burst Board.</sub>');
  lines.push('');
  return lines.join('\n');
}

export async function exportMarkdown(state: AppState): Promise<string | null> {
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog({
    title: 'Export ship log',
    defaultPath: path.join(app.getPath('downloads'), `ship-log-${stamp}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, buildMarkdown(state), 'utf8');
  return result.filePath;
}
