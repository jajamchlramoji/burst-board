/** Shared data model. Used by both the Electron main process and the React UI. */

export type IdeaTag = 'own' | 'fomo';
export type IdeaStatus = 'inbox' | 'shrunk';

export interface Idea {
  id: string;
  text: string;
  sourceLink: string;
  tag: IdeaTag;
  status: IdeaStatus;
  createdAt: string; // ISO
}

export type ShipWhere = 'github' | 'url' | 'x' | 'linkedin' | 'other';
export type ShipStatus = 'active' | 'shipped' | 'parked';

export interface Ship {
  id: string;
  ideaId: string | null;
  title: string;
  /** "What will be live in 2 hours?" */
  liveIn2h: string;
  where: ShipWhere;
  whereOther: string;
  /** "Ugly v1 is..." */
  uglyV1: string;
  status: ShipStatus;
  createdAt: string;
  shippedAt: string | null;
  urls: string[];
  win: string;
  v2: string;
}

export type BurstPhase = 'scope' | 'build' | 'improve' | 'log' | 'done';

export interface BurstSession {
  id: string;
  shipId: string;
  startedAt: string;
  /** Total ms spent paused so far. */
  pausedMs: number;
  /** Set while paused: when the pause began. */
  pausedAt: string | null;
  /** Checkpoint modal already satisfied with a URL. */
  shipped: boolean;
  /** Notifications already fired this burst, so they fire once. */
  firedCheckpoint: boolean;
  firedLogPrompt: boolean;
  miniTimer: boolean;
  /**
   * ISO time until which the ship checkpoint stays hidden ("5 more minutes").
   * Stored on the session, not in the view, so it survives a tab switch and a
   * restart instead of snapping straight back.
   */
  snoozeUntil: string | null;
}

export type BurstOutcome = 'shipped' | 'parked';

export interface BurstRecord {
  id: string;
  shipId: string;
  shipTitle: string;
  startedAt: string;
  endedAt: string;
  outcome: BurstOutcome;
  /** Minutes of actual (unpaused) burst time. */
  minutes: number;
}

/** "system" follows macOS; the other two override it. */
export type ThemeChoice = 'system' | 'dark' | 'light';

export interface Settings {
  theme: ThemeChoice;
  notificationsEnabled: boolean;
  reminderEnabled: boolean;
  /** 0 = Sunday ... 6 = Saturday */
  reminderDay: number;
  /** "HH:MM", 24h local time */
  reminderTime: string;
  /** ISO date (YYYY-MM-DD) the weekly reminder last fired, so it fires once a week. */
  lastReminderDate: string | null;
  globalHotkeyEnabled: boolean;
}

export interface AppState {
  version: number;
  ideas: Idea[];
  ships: Ship[];
  burst: BurstSession | null;
  history: BurstRecord[];
  settings: Settings;
}

export const MAX_ACTIVE_SHIPS = 5;

export const WHERE_LABELS: Record<ShipWhere, string> = {
  github: 'GitHub',
  url: 'Deployed URL',
  x: 'X',
  linkedin: 'LinkedIn',
  other: 'Other',
};

export const FOMO_TEMPLATE = (x: string) => `My tiny take on ${x}`;
