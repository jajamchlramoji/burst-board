/**
 * The contract between the preload bridge and the UI.
 *
 * This is the single source of truth: `electron/preload.ts` is typed as
 * `BurstApi`, and the renderer sees `window.burst` as `BurstApi`. Change one
 * side without the other and the build fails instead of drifting silently.
 */
import type { AppState, BurstOutcome, Idea, IdeaTag, Settings, Ship, ShipWhere } from './types';

export type Reply = { ok: true; state: AppState } | { ok: false; error: string };

export type ExportResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

export interface ShipDraft {
  ideaId: string | null;
  title: string;
  liveIn2h: string;
  where: ShipWhere;
  whereOther?: string;
  uglyV1?: string;
}

export interface BurstApi {
  getState: () => Promise<AppState>;
  dataFile: () => Promise<string>;
  onStateChanged: (cb: (state: AppState) => void) => () => void;
  onNavigate: (cb: (route: string) => void) => () => void;

  ideas: {
    add: (input: { text: string; sourceLink?: string; tag?: IdeaTag }) => Promise<Reply>;
    update: (id: string, patch: Partial<Idea>) => Promise<Reply>;
    remove: (id: string) => Promise<Reply>;
  };

  ships: {
    create: (input: ShipDraft) => Promise<Reply>;
    update: (id: string, patch: Partial<Ship>) => Promise<Reply>;
    park: (id: string, blockedReason: string) => Promise<Reply>;
    unpark: (id: string) => Promise<Reply>;
    remove: (id: string) => Promise<Reply>;
    addUrl: (id: string, url: string) => Promise<Reply>;
    removeUrl: (id: string, url: string) => Promise<Reply>;
  };

  burst: {
    start: (shipId: string) => Promise<Reply>;
    pause: () => Promise<Reply>;
    resume: () => Promise<Reply>;
    shipNow: (url: string) => Promise<Reply>;
    ackCheckpoint: () => Promise<Reply>;
    ackLogPrompt: () => Promise<Reply>;
    /** Hide the ship checkpoint for a few minutes. Survives tabs and restarts. */
    snooze: (minutes: number) => Promise<Reply>;
    setMini: (on: boolean) => Promise<Reply>;
    end: (outcome: BurstOutcome, blockedReason?: string) => Promise<Reply>;
  };

  settings: { update: (patch: Partial<Settings>) => Promise<Reply> };

  openExternal: (url: string) => Promise<boolean>;
  openCapture: () => Promise<void>;
  closeCapture: () => Promise<void>;
  exportMarkdown: () => Promise<ExportResult>;
}
