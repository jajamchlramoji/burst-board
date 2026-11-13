import type { BurstPhase, BurstRecord, BurstSession, Ship } from './types';

export const MIN = 60 * 1000;

/** Burst shape: 4 hours total. */
export const SCOPE_END_MS = 15 * MIN; // 0:00 - 0:15 scope
export const SHIP_CHECKPOINT_MS = 120 * MIN; // 2:00 ship checkpoint
export const LOG_PROMPT_MS = 230 * MIN; // final 10 minutes
export const BURST_END_MS = 240 * MIN; // 4:00

/** Unpaused milliseconds elapsed in a burst, as of `now`. */
export function elapsedMs(burst: BurstSession, now: number = Date.now()): number {
  const started = new Date(burst.startedAt).getTime();
  const pauseNow = burst.pausedAt ? now - new Date(burst.pausedAt).getTime() : 0;
  return Math.max(0, now - started - burst.pausedMs - pauseNow);
}

export function phaseOf(ms: number): BurstPhase {
  if (ms < SCOPE_END_MS) return 'scope';
  if (ms < SHIP_CHECKPOINT_MS) return 'build';
  if (ms < LOG_PROMPT_MS) return 'improve';
  if (ms < BURST_END_MS) return 'log';
  return 'done';
}

export const PHASE_LABEL: Record<BurstPhase, string> = {
  scope: 'Scope',
  build: 'Build',
  improve: 'Improve & reship',
  log: 'Log it',
  done: 'Burst complete',
};

export const PHASE_HINT: Record<BurstPhase, string> = {
  scope: 'First 15 minutes. Just get clear on the one sentence below.',
  build: 'Build the ugly version. Done early? Ship it now. Checkpoint at 2:00.',
  improve: 'Bonus time. Already shipped? Make it a bit better and reship.',
  log: 'Final 10 minutes. Write the one-line win and the possible v2.',
  done: 'Four hours done. Log it and rest.',
};

/** Phase boundaries for the progress bar. */
export const PHASE_SEGMENTS = [
  { phase: 'scope' as BurstPhase, from: 0, to: SCOPE_END_MS },
  { phase: 'build' as BurstPhase, from: SCOPE_END_MS, to: SHIP_CHECKPOINT_MS },
  { phase: 'improve' as BurstPhase, from: SHIP_CHECKPOINT_MS, to: LOG_PROMPT_MS },
  { phase: 'log' as BurstPhase, from: LOG_PROMPT_MS, to: BURST_END_MS },
];

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD for an ISO timestamp. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Ship streak, counted in BURST DAYS.
 * Days with no burst are skipped entirely - they never break the streak.
 * Walking back from the most recent burst day, count consecutive burst days
 * that produced at least one ship. A burst day that shipped nothing ends it.
 */
export function shipStreak(history: BurstRecord[]): number {
  const byDay = new Map<string, boolean>();
  for (const r of history) {
    const day = localDay(r.startedAt);
    byDay.set(day, (byDay.get(day) ?? false) || r.outcome === 'shipped');
  }
  const days = [...byDay.keys()].sort().reverse();
  let streak = 0;
  for (const day of days) {
    if (byDay.get(day)) streak += 1;
    else break;
  }
  return streak;
}

export function shipsThisMonth(ships: Ship[], now: Date = new Date()): number {
  return ships.filter((s) => {
    if (!s.shippedAt) return false;
    const d = new Date(s.shippedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

/**
 * Whole days since the most recent burst day, or null with no history at all.
 * The streak deliberately ignores quiet days, which means it keeps showing a
 * number long after you last used the app - this is what gives it context.
 */
export function daysSinceLastBurst(history: BurstRecord[], now: Date = new Date()): number | null {
  if (history.length === 0) return null;
  const latest = [...history.map((r) => localDay(r.startedAt))].sort().reverse()[0];
  if (!latest) return null;
  const then = Date.parse(`${latest}T00:00:00`);
  const today = Date.parse(`${localDay(now.toISOString())}T00:00:00`);
  return Math.max(0, Math.round((today - then) / 86_400_000));
}

export function burstDayCount(history: BurstRecord[]): number {
  return new Set(history.map((r) => localDay(r.startedAt))).size;
}
