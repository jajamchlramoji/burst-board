import { BrowserWindow, ipcMain, shell } from 'electron';
import { Store } from './store';
import { elapsedMs } from '../shared/burst';
import type {
  AppState,
  BurstOutcome,
  Idea,
  IdeaTag,
  Ship,
  ShipWhere,
  Settings,
} from '../shared/types';
import { FOMO_TEMPLATE, MAX_ACTIVE_SHIPS } from '../shared/types';

export type Reply<T = AppState> = { ok: true; state: AppState; value?: T } | { ok: false; error: string };

/** Hooks the main process provides; phase-2 features plug in here. */
export interface IpcHooks {
  broadcast: () => void;
  openCapture?: () => void;
  closeCapture?: () => void;
  setMiniTimer?: (on: boolean) => void;
  exportMarkdown?: () => Promise<string | null>;
  refreshTray?: () => void;
  applyHotkey?: () => void;
  startBurstFlow?: () => void;
}

export function isPublicUrl(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  let u: URL;
  try {
    u = new URL(text.includes('://') ? text : `https://${text}`);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (!host.includes('.')) return false;
  return true;
}

export function normalizeUrl(raw: string): string {
  const text = raw.trim();
  return text.includes('://') ? text : `https://${text}`;
}

export function suggestedTitle(idea: Pick<Idea, 'text' | 'tag'>): string {
  return idea.tag === 'fomo' ? FOMO_TEMPLATE(idea.text.trim()) : idea.text.trim();
}

function activeCount(state: AppState): number {
  return state.ships.filter((s) => s.status === 'active').length;
}

export function registerIpc(store: Store, hooks: IpcHooks): void {
  const ok = (value?: unknown): Reply => {
    hooks.broadcast();
    hooks.refreshTray?.();
    return { ok: true, state: store.get(), value: value as AppState | undefined };
  };
  const fail = (error: string): Reply => ({ ok: false, error });

  ipcMain.handle('state:get', () => store.get());
  ipcMain.handle('app:dataFile', () => store.dataFile);

  // ---------- Inbox ----------
  ipcMain.handle(
    'idea:add',
    (_e, input: { text: string; sourceLink?: string; tag?: IdeaTag }): Reply => {
      const text = (input.text ?? '').trim();
      if (!text) return fail('An idea needs at least a few words.');
      const idea: Idea = {
        id: Store.id(),
        text,
        sourceLink: (input.sourceLink ?? '').trim(),
        tag: input.tag === 'fomo' ? 'fomo' : 'own',
        status: 'inbox',
        createdAt: new Date().toISOString(),
      };
      store.update((s) => {
        s.ideas.unshift(idea);
      });
      return ok();
    },
  );

  ipcMain.handle('idea:update', (_e, input: { id: string; patch: Partial<Idea> }): Reply => {
    store.update((s) => {
      const idea = s.ideas.find((i) => i.id === input.id);
      if (idea) Object.assign(idea, input.patch);
    });
    return ok();
  });

  ipcMain.handle('idea:delete', (_e, id: string): Reply => {
    store.update((s) => {
      s.ideas = s.ideas.filter((i) => i.id !== id);
    });
    return ok();
  });

  // ---------- Shrink ----------
  ipcMain.handle(
    'ship:create',
    (
      _e,
      input: {
        ideaId: string | null;
        title: string;
        liveIn2h: string;
        where: ShipWhere;
        whereOther?: string;
        uglyV1?: string;
      },
    ): Reply => {
      const title = (input.title ?? '').trim();
      const liveIn2h = (input.liveIn2h ?? '').trim();
      if (!title) return fail('Give the ship a short title.');
      if (!liveIn2h) return fail('"What will be live in 2 hours?" is required.');
      if (activeCount(store.get()) >= MAX_ACTIVE_SHIPS) {
        return fail(
          `You already have ${MAX_ACTIVE_SHIPS} active ships. Park one first - five is the ceiling on purpose.`,
        );
      }
      const ship: Ship = {
        id: Store.id(),
        ideaId: input.ideaId ?? null,
        title,
        liveIn2h,
        where: input.where ?? 'github',
        whereOther: (input.whereOther ?? '').trim(),
        uglyV1: (input.uglyV1 ?? '').trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        shippedAt: null,
        urls: [],
        win: '',
        v2: '',
      };
      store.update((s) => {
        s.ships.unshift(ship);
        if (input.ideaId) {
          const idea = s.ideas.find((i) => i.id === input.ideaId);
          if (idea) idea.status = 'shrunk';
        }
      });
      return ok();
    },
  );

  ipcMain.handle('ship:update', (_e, input: { id: string; patch: Partial<Ship> }): Reply => {
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (ship) Object.assign(ship, input.patch);
    });
    return ok();
  });

  ipcMain.handle('ship:park', (_e, id: string): Reply => {
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === id);
      if (ship && ship.status === 'active') ship.status = 'parked';
    });
    return ok();
  });

  ipcMain.handle('ship:unpark', (_e, id: string): Reply => {
    if (activeCount(store.get()) >= MAX_ACTIVE_SHIPS) {
      return fail(`${MAX_ACTIVE_SHIPS} active ships already. Park one to bring this back.`);
    }
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === id);
      if (ship) ship.status = 'active';
    });
    return ok();
  });

  ipcMain.handle('ship:delete', (_e, id: string): Reply => {
    store.update((s) => {
      s.ships = s.ships.filter((x) => x.id !== id);
      if (s.burst?.shipId === id) s.burst = null;
    });
    return ok();
  });

  ipcMain.handle('ship:addUrl', (_e, input: { id: string; url: string }): Reply => {
    if (!isPublicUrl(input.url)) return fail('That needs to be a public http(s) URL.');
    const url = normalizeUrl(input.url);
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (!ship) return;
      if (!ship.urls.includes(url)) ship.urls.push(url);
      if (ship.status !== 'shipped') {
        ship.status = 'shipped';
        ship.shippedAt = new Date().toISOString();
      }
    });
    return ok();
  });

  ipcMain.handle('ship:removeUrl', (_e, input: { id: string; url: string }): Reply => {
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (ship) ship.urls = ship.urls.filter((u) => u !== input.url);
    });
    return ok();
  });

  // ---------- Burst ----------
  ipcMain.handle('burst:start', (_e, shipId: string): Reply => {
    const state = store.get();
    const ship = state.ships.find((x) => x.id === shipId);
    if (!ship) return fail('That ship is gone.');
    if (state.burst) return fail('A burst is already running.');
    store.update((s) => {
      s.burst = {
        id: Store.id(),
        shipId,
        startedAt: new Date().toISOString(),
        pausedMs: 0,
        pausedAt: null,
        shipped: ship.status === 'shipped',
        firedCheckpoint: false,
        firedLogPrompt: false,
        miniTimer: false,
      };
    });
    return ok();
  });

  ipcMain.handle('burst:pause', (): Reply => {
    store.update((s) => {
      if (s.burst && !s.burst.pausedAt) s.burst.pausedAt = new Date().toISOString();
    });
    return ok();
  });

  ipcMain.handle('burst:resume', (): Reply => {
    store.update((s) => {
      if (s.burst?.pausedAt) {
        s.burst.pausedMs += Date.now() - new Date(s.burst.pausedAt).getTime();
        s.burst.pausedAt = null;
      }
    });
    return ok();
  });

  ipcMain.handle('burst:shipNow', (_e, url: string): Reply => {
    if (!isPublicUrl(url)) {
      return fail('Paste a public http(s) link - that is what makes it shipped.');
    }
    const clean = normalizeUrl(url);
    store.update((s) => {
      if (!s.burst) return;
      s.burst.shipped = true;
      const ship = s.ships.find((x) => x.id === s.burst!.shipId);
      if (ship) {
        if (!ship.urls.includes(clean)) ship.urls.push(clean);
        ship.status = 'shipped';
        ship.shippedAt = ship.shippedAt ?? new Date().toISOString();
      }
    });
    return ok();
  });

  ipcMain.handle('burst:ackCheckpoint', (): Reply => {
    store.update((s) => {
      if (s.burst) s.burst.firedCheckpoint = true;
    });
    return ok();
  });

  ipcMain.handle('burst:ackLogPrompt', (): Reply => {
    store.update((s) => {
      if (s.burst) s.burst.firedLogPrompt = true;
    });
    return ok();
  });

  ipcMain.handle('burst:setMini', (_e, on: boolean): Reply => {
    store.update((s) => {
      if (s.burst) s.burst.miniTimer = on;
    });
    hooks.setMiniTimer?.(on);
    return ok();
  });

  ipcMain.handle('burst:end', (_e, outcome: BurstOutcome): Reply => {
    const state = store.get();
    if (!state.burst) return fail('No burst running.');
    const burst = state.burst;
    const ship = state.ships.find((x) => x.id === burst.shipId);
    const minutes = Math.round(elapsedMs(burst) / 60000);
    const resolved: BurstOutcome = burst.shipped ? 'shipped' : outcome;
    store.update((s) => {
      s.history.unshift({
        id: burst.id,
        shipId: burst.shipId,
        shipTitle: ship?.title ?? 'Untitled ship',
        startedAt: burst.startedAt,
        endedAt: new Date().toISOString(),
        outcome: resolved,
        minutes,
      });
      const target = s.ships.find((x) => x.id === burst.shipId);
      if (target && resolved === 'parked' && target.status === 'active') {
        target.status = 'parked';
      }
      s.burst = null;
    });
    hooks.setMiniTimer?.(false);
    store.saveNow();
    return ok();
  });

  // ---------- Settings & misc ----------
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>): Reply => {
    store.update((s) => {
      Object.assign(s.settings, patch);
    });
    hooks.applyHotkey?.();
    return ok();
  });

  ipcMain.handle('shell:open', async (_e, url: string) => {
    if (!isPublicUrl(url)) return false;
    await shell.openExternal(normalizeUrl(url));
    return true;
  });

  ipcMain.handle('window:openCapture', () => {
    hooks.openCapture?.();
  });

  ipcMain.handle('window:closeCapture', () => {
    hooks.closeCapture?.();
  });

  ipcMain.handle('export:markdown', async () => {
    return (await hooks.exportMarkdown?.()) ?? null;
  });
}

export function broadcastState(store: Store): void {
  const state = store.get();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('state:changed', state);
  }
}
