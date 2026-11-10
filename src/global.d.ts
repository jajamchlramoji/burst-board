import type {
  AppState,
  BurstOutcome,
  Idea,
  IdeaTag,
  Settings,
  Ship,
  ShipWhere,
} from '../shared/types';

export type Reply = { ok: true; state: AppState } | { ok: false; error: string };

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
    create: (input: {
      ideaId: string | null;
      title: string;
      liveIn2h: string;
      where: ShipWhere;
      whereOther?: string;
      uglyV1?: string;
    }) => Promise<Reply>;
    update: (id: string, patch: Partial<Ship>) => Promise<Reply>;
    park: (id: string) => Promise<Reply>;
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
    setMini: (on: boolean) => Promise<Reply>;
    end: (outcome: BurstOutcome) => Promise<Reply>;
  };
  settings: { update: (patch: Partial<Settings>) => Promise<Reply> };
  openExternal: (url: string) => Promise<boolean>;
  openCapture: () => Promise<void>;
  closeCapture: () => Promise<void>;
  exportMarkdown: () => Promise<string | null>;
}

declare global {
  interface Window {
    burst: BurstApi;
  }
}
