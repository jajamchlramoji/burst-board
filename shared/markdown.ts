/** Ship log as Markdown. Pure: no Electron, so it is directly testable. */
import type { AppState, Ship } from './types';
import { WHERE_LABELS } from './types';
import { burstDayCount, shipStreak, shipsThisMonth } from './burst';

function day(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * The export is meant to be published - pasted into a README, a gist, a post -
 * so a title like "**ugly** v1" or "a [thing](x)" must appear as written
 * instead of reformatting the document it lands in. These are all one-line
 * fields, so newlines collapse too.
 */
export function mdInline(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]()<>|~#])/g, '\\$1')
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim();
}

export function buildMarkdown(state: AppState): string {
  const shipped: Ship[] = state.ships
    .filter((s) => s.status === 'shipped' && s.shippedAt)
    .sort((a, b) => b.shippedAt!.localeCompare(a.shippedAt!));

  const streak = shipStreak(state.history);
  const days = burstDayCount(state.history);
  const lines: string[] = [];

  lines.push('# Ship log');
  lines.push('');
  lines.push(
    `**${shipped.length} ${shipped.length === 1 ? 'ship' : 'ships'}** · ` +
      `**${shipsThisMonth(state.ships)} this month** · ` +
      `**${streak}-burst-day ship streak** · ` +
      `${days} burst ${days === 1 ? 'day' : 'days'}`,
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
    lines.push(`## ${mdInline(s.title)}`);
    lines.push('');
    const where =
      s.where === 'other' && s.whereOther
        ? `${WHERE_LABELS[s.where]}: ${mdInline(s.whereOther)}`
        : WHERE_LABELS[s.where];
    lines.push(`*${day(s.shippedAt!)} · ${where}*`);
    lines.push('');
    if (s.liveIn2h) {
      lines.push(mdInline(s.liveIn2h));
      lines.push('');
    }
    // Angle brackets keep a URL intact even with parentheses or stray spaces.
    for (const u of s.urls) lines.push(`- <${u}>`);
    if (s.urls.length) lines.push('');
    if (s.win) {
      lines.push(`**Win:** ${mdInline(s.win)}`);
      lines.push('');
    }
    if (s.v2) {
      lines.push(`**Possible v2:** ${mdInline(s.v2)}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('<sub>Exported from Burst Board.</sub>');
  lines.push('');
  return lines.join('\n');
}
