/** A 1200x675 image of one ship, sized for LinkedIn and X posts. */
export const CARD_W = 1200;
export const CARD_H = 675;

export interface CardData {
  title: string;
  win: string;
  url: string | null;
  minutes: number;
  bursts: number;
  shippedAt: string | null;
}

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
const SAGE = '#8ed1a8';
const SILVER = '#e3e4e6';
const MUTED = '#8f9196';

/** Split text into at most `max` lines that fit `width`, ellipsizing the last. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function burstTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export async function drawShareCard(canvas: HTMLCanvasElement, d: CardData): Promise<void> {
  await Promise.all([
    document.fonts.load(`76px ${SERIF}`),
    document.fonts.load(`italic 38px ${SERIF}`),
  ]).catch(() => {});
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d')!;

  // Background: graphite with a soft sage glow.
  const bg = g.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#2b2d31');
  bg.addColorStop(1, '#1b1d20');
  g.fillStyle = bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  const glow = g.createRadialGradient(1020, 90, 0, 1020, 90, 560);
  glow.addColorStop(0, 'rgba(142, 209, 168, 0.20)');
  glow.addColorStop(1, 'rgba(142, 209, 168, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, CARD_W, CARD_H);

  const X = 84;

  // Mark + eyebrow + date.
  const mark = g.createLinearGradient(0, 70, 0, 118);
  mark.addColorStop(0, '#a9dfbe');
  mark.addColorStop(1, SAGE);
  g.fillStyle = mark;
  roundRect(g, X, 70, 48, 48, 14);
  g.fill();
  g.fillStyle = '#0e2418';
  g.beginPath();
  const bolt = [[0.58, 0.04], [0.17, 0.58], [0.45, 0.58], [0.38, 0.96], [0.83, 0.42], [0.55, 0.42]];
  bolt.forEach(([bx, by], i) => (i ? g.lineTo : g.moveTo).call(g, X + 8 + bx * 32, 78 + by * 32));
  g.closePath();
  g.fill();

  g.font = `600 17px ${SANS}`;
  g.letterSpacing = '4px';
  g.fillStyle = SAGE;
  g.textBaseline = 'middle';
  g.fillText('SHIPPED', X + 68, 95);
  if (d.shippedAt) {
    g.textAlign = 'right';
    g.letterSpacing = '0px';
    g.fillStyle = MUTED;
    g.font = `500 20px ${SANS}`;
    g.fillText(
      new Date(d.shippedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      CARD_W - X,
      95,
    );
    g.textAlign = 'left';
  }
  g.letterSpacing = '0px';

  // Title.
  g.textBaseline = 'alphabetic';
  g.fillStyle = SILVER;
  g.font = `76px ${SERIF}`;
  const titleLines = wrap(g, d.title, CARD_W - X * 2, 2);
  let y = 236;
  for (const l of titleLines) {
    g.fillText(l, X, y);
    y += 84;
  }

  // Win, in italic.
  if (d.win.trim()) {
    y += 8;
    g.fillStyle = '#c4c6ca';
    g.font = `italic 38px ${SERIF}`;
    for (const l of wrap(g, `“${d.win.trim()}”`, CARD_W - X * 2, 2)) {
      g.fillText(l, X, y);
      y += 48;
    }
  }

  // Chips along the bottom.
  const chips = [
    d.minutes > 0 ? `${burstTime(d.minutes)} in bursts` : null,
    d.bursts > 0 ? `${d.bursts} ${d.bursts === 1 ? 'burst' : 'bursts'}` : null,
    d.url ? d.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
  ].filter((c): c is string => Boolean(c));
  g.font = `500 21px ${SANS}`;
  g.textBaseline = 'middle';
  let cx = X;
  const cy = CARD_H - 112;
  for (const c of chips) {
    let text = c;
    const room = CARD_W - X - cx - 40;
    while (text.length > 4 && g.measureText(text).width > room) text = `${text.slice(0, -2)}…`;
    const w = g.measureText(text).width + 40;
    if (w > room + 40) break;
    roundRect(g, cx, cy - 22, w, 44, 22);
    g.fillStyle = 'rgba(142, 209, 168, 0.11)';
    g.fill();
    g.strokeStyle = 'rgba(142, 209, 168, 0.32)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = SAGE;
    g.fillText(text, cx + 20, cy + 1);
    cx += w + 12;
  }

  // Footer.
  g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(X, CARD_H - 62);
  g.lineTo(CARD_W - X, CARD_H - 62);
  g.stroke();
  g.font = `500 17px ${SANS}`;
  g.fillStyle = MUTED;
  g.fillText('Built one burst at a time', X, CARD_H - 34);
  g.textAlign = 'right';
  g.fillStyle = SILVER;
  g.fillText('Burst Board', CARD_W - X, CARD_H - 34);
  g.textAlign = 'left';
}

/** The post text that goes alongside the image. */
export function shareText(d: CardData): string {
  const lines = [`Shipped: ${d.title}`];
  if (d.win.trim()) lines.push(d.win.trim());
  if (d.url) lines.push(d.url);
  return lines.join('\n\n');
}
