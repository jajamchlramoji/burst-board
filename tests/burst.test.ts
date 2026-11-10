import { describe, expect, it } from 'vitest';
import type { BurstRecord, BurstSession, Ship } from '../shared/types';
import {
  BURST_END_MS,
  LOG_PROMPT_MS,
  MIN,
  SCOPE_END_MS,
  SHIP_CHECKPOINT_MS,
  burstDayCount,
  elapsedMs,
  formatClock,
  formatShort,
  phaseOf,
  shipStreak,
  shipsThisMonth,
} from '../shared/burst';

function session(over: Partial<BurstSession> = {}): BurstSession {
  return {
    id: 'b1',
    shipId: 's1',
    startedAt: '2026-11-10T09:00:00.000Z',
    pausedMs: 0,
    pausedAt: null,
    shipped: false,
    firedCheckpoint: false,
    firedLogPrompt: false,
    miniTimer: false,
    snoozeUntil: null,
    ...over,
  };
}

/** A burst record on a given local day. */
function record(day: string, outcome: 'shipped' | 'parked'): BurstRecord {
  return {
    id: `r-${day}-${outcome}`,
    shipId: 's1',
    shipTitle: 'A ship',
    startedAt: `${day}T10:00:00`,
    endedAt: `${day}T14:00:00`,
    outcome,
    minutes: 240,
  };
}

const at = (iso: string) => new Date(iso).getTime();

describe('elapsedMs', () => {
  it('counts wall-clock time while running', () => {
    expect(elapsedMs(session(), at('2026-11-10T10:30:00.000Z'))).toBe(90 * MIN);
  });

  it('subtracts time already spent paused', () => {
    const b = session({ pausedMs: 20 * MIN });
    expect(elapsedMs(b, at('2026-11-10T10:00:00.000Z'))).toBe(40 * MIN);
  });

  it('holds still while currently paused', () => {
    const b = session({ pausedAt: '2026-11-10T09:30:00.000Z' });
    expect(elapsedMs(b, at('2026-11-10T09:30:00.000Z'))).toBe(30 * MIN);
    // Half an hour later, still paused: the clock has not moved.
    expect(elapsedMs(b, at('2026-11-10T10:00:00.000Z'))).toBe(30 * MIN);
  });

  it('never goes negative if the clock jumped backwards', () => {
    expect(elapsedMs(session(), at('2026-11-10T08:00:00.000Z'))).toBe(0);
  });

  it('treats a long sleep as paused time once it is folded in', () => {
    // What powerMonitor does on resume: add the slept span to pausedMs.
    const slept = 9 * 60 * MIN;
    const b = session({ pausedMs: slept });
    expect(elapsedMs(b, at('2026-11-10T19:00:00.000Z'))).toBe(60 * MIN);
  });
});

describe('phaseOf', () => {
  it('walks the four phases at the documented boundaries', () => {
    expect(phaseOf(0)).toBe('scope');
    expect(phaseOf(SCOPE_END_MS - 1)).toBe('scope');
    expect(phaseOf(SCOPE_END_MS)).toBe('build');
    expect(phaseOf(SHIP_CHECKPOINT_MS - 1)).toBe('build');
    expect(phaseOf(SHIP_CHECKPOINT_MS)).toBe('improve');
    expect(phaseOf(LOG_PROMPT_MS - 1)).toBe('improve');
    expect(phaseOf(LOG_PROMPT_MS)).toBe('log');
    expect(phaseOf(BURST_END_MS - 1)).toBe('log');
    expect(phaseOf(BURST_END_MS)).toBe('done');
  });

  it('puts the checkpoint at 2:00 and the log prompt in the final 10 minutes', () => {
    expect(SHIP_CHECKPOINT_MS).toBe(120 * MIN);
    expect(BURST_END_MS - LOG_PROMPT_MS).toBe(10 * MIN);
  });
});

describe('shipStreak - days without a burst never break it', () => {
  it('is 0 with no history', () => {
    expect(shipStreak([])).toBe(0);
  });

  it('counts consecutive burst days that shipped, ignoring the gaps', () => {
    const h = [record('2026-11-01', 'shipped'), record('2026-11-09', 'shipped'), record('2026-11-17', 'shipped')];
    expect(shipStreak(h)).toBe(3);
  });

  it('stops at a burst day that shipped nothing', () => {
    const h = [record('2026-11-01', 'shipped'), record('2026-11-02', 'parked')];
    expect(shipStreak(h)).toBe(0);
  });

  it('keeps the streak behind a parked day it has already passed', () => {
    const h = [
      record('2026-11-01', 'shipped'),
      record('2026-11-05', 'parked'),
      record('2026-11-08', 'shipped'),
      record('2026-11-09', 'shipped'),
    ];
    expect(shipStreak(h)).toBe(2);
  });

  it('counts a day as shipped if any burst that day shipped', () => {
    const h = [record('2026-11-09', 'parked'), record('2026-11-09', 'shipped')];
    expect(shipStreak(h)).toBe(1);
  });

  it('does not care what order the history is stored in', () => {
    const h = [record('2026-11-09', 'shipped'), record('2026-11-01', 'shipped')];
    expect(shipStreak(h)).toBe(2);
    expect(shipStreak([...h].reverse())).toBe(2);
  });

  it('sorts days chronologically across a month and year boundary', () => {
    const h = [record('2025-12-31', 'shipped'), record('2026-01-01', 'shipped')];
    expect(shipStreak(h)).toBe(2);
  });
});

describe('burstDayCount', () => {
  it('counts distinct days, not bursts', () => {
    const h = [record('2026-11-09', 'shipped'), record('2026-11-09', 'parked'), record('2026-11-10', 'shipped')];
    expect(burstDayCount(h)).toBe(2);
  });
});

describe('shipsThisMonth', () => {
  const ship = (shippedAt: string | null): Ship => ({
    id: Math.random().toString(), ideaId: null, title: 't', liveIn2h: 'x', where: 'github',
    whereOther: '', uglyV1: '', status: shippedAt ? 'shipped' : 'active',
    createdAt: '2026-11-01T00:00:00', shippedAt, urls: [], win: '', v2: '',
  });

  it('counts only ships shipped in the current month', () => {
    const now = new Date('2026-11-15T12:00:00');
    const ships = [ship('2026-11-02T10:00:00'), ship('2026-11-14T10:00:00'), ship('2026-10-30T10:00:00'), ship(null)];
    expect(shipsThisMonth(ships, now)).toBe(2);
  });

  it('does not count the same month a year earlier', () => {
    expect(shipsThisMonth([ship('2025-11-02T10:00:00')], new Date('2026-11-15T12:00:00'))).toBe(0);
  });
});

describe('clock formatting', () => {
  it('formats h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(65 * 1000)).toBe('0:01:05');
    expect(formatClock(BURST_END_MS)).toBe('4:00:00');
  });
  it('formats h:mm for the menu bar', () => {
    expect(formatShort(0)).toBe('0:00');
    expect(formatShort(SHIP_CHECKPOINT_MS)).toBe('2:00');
  });
  it('clamps negatives to zero', () => {
    expect(formatClock(-5000)).toBe('0:00:00');
  });
});
