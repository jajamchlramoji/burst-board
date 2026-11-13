import { BrowserWindow, ipcMain, shell } from 'electron';
import { Store } from './store';
import { BURST_END_MS, elapsedMs } from '../shared/burst';
import { isPublicUrl, normalizeUrl } from '../shared/url';
import type { ExportResult, Reply } from '../shared/api';
import type {
  AppState,
  BurstOutcome,
  Idea,
  IdeaStatus,
  IdeaTag,
  Settings,
  Ship,
  ShipWhere,
} from '../shared/types';
import {
  EMPTY_IDEA_MESSAGE,
  FOMO_TEMPLATE,
  IDEA_TAGS,
  MAX_ACTIVE_SHIPS,
  WHERE_LABELS,
} from '../shared/types';

export type { Reply };

/** Hooks the main process provides. */
export interface IpcHooks {
  broadcast: () => void;
  openCapture?: () => void;
  closeCapture?: () => void;
  setMiniTimer?: (on: boolean) => void;
  exportMarkdown?: () => Promise<ExportResult>;
  refreshTray?: () => void;
  applyHotkey?: () => void;
  applyTheme?: () => void;
  startBurstFlow?: () => void;
  showMain?: () => void;
}

export { isPublicUrl, normalizeUrl };

/** A burst left running this long past 4:00 is yesterday's - close it out. */
export const STALE_GRACE_MS = 30 * 60 * 1000;

export function suggestedTitle(idea: Pick<Idea, 'text' | 'tag'>): string {
  return idea.tag === 'fomo' ? FOMO_TEMPLATE(idea.text.trim()) : idea.text.trim();
}

function activeCount(state: AppState): number {
  return state.ships.filter((s) => s.status === 'active').length;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Patches arrive from the renderer as plain objects; `Partial<T>` is only a
 * compile-time promise. Each field is copied across explicitly so a patch can
 * never reach a field with its own rules - a ship cannot be marked shipped
 * without a public URL, for instance.
 */
function ideaPatch(raw: unknown): Partial<Idea> {
  const p = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Idea> = {};
  const text = str(p.text)?.trim();
  if (text) out.text = text;
  const link = str(p.sourceLink);
  if (link !== undefined) out.sourceLink = link.trim();
  if (IDEA_TAGS.includes(p.tag as IdeaTag)) out.tag = p.tag as IdeaTag;
  if (p.status === 'inbox' || p.status === 'shrunk') out.status = p.status as IdeaStatus;
  return out;
}

function shipPatch(raw: unknown): Partial<Ship> {
  const p = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Ship> = {};
  const title = str(p.title)?.trim();
  if (title) out.title = title;
  const live = str(p.liveIn2h)?.trim();
  if (live) out.liveIn2h = live;
  if (typeof p.where === 'string' && p.where in WHERE_LABELS) {
    out.where = p.where as ShipWhere;
  }
  for (const key of ['whereOther', 'uglyV1', 'win', 'v2', 'blockedReason'] as const) {
    const v = str(p[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function settingsPatch(raw: unknown): Partial<Settings> {
  const p = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Settings> = {};
  for (const key of ['notificationsEnabled', 'reminderEnabled', 'globalHotkeyEnabled'] as const) {
    if (typeof p[key] === 'boolean') out[key] = p[key] as boolean;
  }
  if (Number.isInteger(p.reminderDay)) {
    const d = p.reminderDay as number;
    if (d >= 0 && d <= 6) out.reminderDay = d;
  }
  if (p.theme === 'system' || p.theme === 'dark' || p.theme === 'light') {
    out.theme = p.theme;
  }
  const time = str(p.reminderTime)?.trim();
  if (time) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h <= 23 && min <= 59) out.reminderTime = `${String(h).padStart(2, '0')}:${m[2]}`;
    }
  }
  if (p.lastReminderDate === null || typeof p.lastReminderDate === 'string') {
    out.lastReminderDate = p.lastReminderDate as string | null;
  }
  return out;
}

/**
 * Close out the running burst and write it to the history. Shared by the
 * "End burst" button and by the stale-burst cleanup on launch and on wake, so
 * a burst can never vanish without being recorded.
 */
export function finishBurst(store: Store, outcome: BurstOutcome, now = Date.now(), blockedReason = ''): boolean {
  const state = store.get();
  const burst = state.burst;
  if (!burst) return false;
  const ship = state.ships.find((x) => x.id === burst.shipId);
  const resolved: BurstOutcome = burst.shipped ? 'shipped' : outcome;
  // Capped: a burst that ran while the laptop slept should not log 19 hours.
  const minutes = Math.min(
    Math.round(elapsedMs(burst, now) / 60000),
    Math.round(BURST_END_MS / 60000),
  );
  store.update((s) => {
    s.history.unshift({
      id: burst.id,
      shipId: burst.shipId,
      shipTitle: ship?.title ?? 'Untitled ship',
      startedAt: burst.startedAt,
      endedAt: new Date(now).toISOString(),
      outcome: resolved,
      minutes,
    });
    const target = s.ships.find((x) => x.id === burst.shipId);
    if (target && resolved === 'parked' && target.status === 'active') {
      target.status = 'parked';
      if (blockedReason.trim()) target.blockedReason = blockedReason.trim();
    }
    s.burst = null;
  });
  store.saveNow();
  return true;
}

export function registerIpc(store: Store, hooks: IpcHooks): void {
  const ok = (): Reply => {
    hooks.broadcast();
    hooks.refreshTray?.();
    return { ok: true, state: store.get() };
  };
  const fail = (error: string): Reply => ({ ok: false, error });

  ipcMain.handle('state:get', () => store.get());
  ipcMain.handle('app:dataFile', () => store.dataFile);

  // ---------- Inbox ----------
  ipcMain.handle('idea:add', (_e, input: unknown): Reply => {
    const p = (input ?? {}) as Record<string, unknown>;
    const text = (str(p.text) ?? '').trim();
    if (!text) return fail(EMPTY_IDEA_MESSAGE);
    const idea: Idea = {
      id: Store.id(),
      text,
      sourceLink: (str(p.sourceLink) ?? '').trim(),
      tag: IDEA_TAGS.includes(p.tag as IdeaTag) ? (p.tag as IdeaTag) : 'own',
      status: 'inbox',
      createdAt: new Date().toISOString(),
    };
    store.update((s) => {
      s.ideas.unshift(idea);
    });
    return ok();
  });

  ipcMain.handle('idea:update', (_e, input: { id: string; patch: unknown }): Reply => {
    const patch = ideaPatch(input?.patch);
    const found = store.get().ideas.some((i) => i.id === input?.id);
    if (!found) return fail('That idea is gone.');
    store.update((s) => {
      const idea = s.ideas.find((i) => i.id === input.id);
      if (idea) Object.assign(idea, patch);
    });
    return ok();
  });

  // One level of undo for the destructive actions: each one records how to
  // put back exactly what it took away.
  let undo: ((s: AppState) => void) | null = null;

  const restoreAt = <T extends { id: string }>(list: T[], item: T, index: number) => {
    if (!list.some((x) => x.id === item.id)) list.splice(Math.min(index, list.length), 0, item);
  };

  ipcMain.handle('app:undo', (): Reply => {
    const run = undo;
    if (!run) return fail('Nothing to undo.');
    undo = null;
    store.update(run);
    return ok();
  });

  ipcMain.handle('idea:delete', (_e, id: string): Reply => {
    const ideas = store.get().ideas;
    const index = ideas.findIndex((i) => i.id === id);
    if (index === -1) return ok();
    const removed = structuredClone(ideas[index]);
    store.update((s) => {
      s.ideas = s.ideas.filter((i) => i.id !== id);
    });
    undo = (s) => restoreAt(s.ideas, removed, index);
    return ok();
  });

  // ---------- Shrink ----------
  ipcMain.handle('ship:create', (_e, input: unknown): Reply => {
    const p = (input ?? {}) as Record<string, unknown>;
    const title = (str(p.title) ?? '').trim();
    const liveIn2h = (str(p.liveIn2h) ?? '').trim();
    if (!title) return fail('Give the ship a short title.');
    if (!liveIn2h) return fail('"What will be live in 2 hours?" is required.');
    if (activeCount(store.get()) >= MAX_ACTIVE_SHIPS) {
      return fail(
        `You already have ${MAX_ACTIVE_SHIPS} active ships. Park one first - five is the ceiling on purpose.`,
      );
    }
    const where =
      typeof p.where === 'string' && p.where in WHERE_LABELS
        ? (p.where as ShipWhere)
        : 'github';
    const ideaId = str(p.ideaId) ?? null;
    const ship: Ship = {
      id: Store.id(),
      ideaId,
      title,
      liveIn2h,
      where,
      whereOther: (str(p.whereOther) ?? '').trim(),
      uglyV1: (str(p.uglyV1) ?? '').trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
      shippedAt: null,
      urls: [],
      win: '',
      v2: '',
      blockedReason: '',
    };
    store.update((s) => {
      s.ships.unshift(ship);
      if (ideaId) {
        const idea = s.ideas.find((i) => i.id === ideaId);
        if (idea) idea.status = 'shrunk';
      }
    });
    return ok();
  });

  ipcMain.handle('ship:update', (_e, input: { id: string; patch: unknown }): Reply => {
    const patch = shipPatch(input?.patch);
    const found = store.get().ships.some((x) => x.id === input?.id);
    if (!found) return fail('That ship is gone.');
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (ship) Object.assign(ship, patch);
    });
    return ok();
  });

  ipcMain.handle('ship:park', (_e, input: { id: string; blockedReason: string }): Reply => {
    const { id, blockedReason } = (input ?? {}) as { id?: string; blockedReason?: string };
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === id);
      if (ship && ship.status === 'active') {
        ship.status = 'parked';
        ship.blockedReason = (typeof blockedReason === 'string' ? blockedReason : '').trim();
      }
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
    // A burst on this ship has to be closed out first, or its mini timer is
    // left floating on screen and the burst never reaches the history.
    if (store.get().burst?.shipId === id) {
      finishBurst(store, 'parked');
      hooks.setMiniTimer?.(false);
    }
    const index = store.get().ships.findIndex((x) => x.id === id);
    if (index === -1) return ok();
    const removed = structuredClone(store.get().ships[index]);
    store.update((s) => {
      s.ships = s.ships.filter((x) => x.id !== id);
    });
    undo = (s) => restoreAt(s.ships, removed, index);
    return ok();
  });

  // Takes a ship off the board and puts its idea back in the Inbox: the idea
  // it came from if that still exists, otherwise a new one from its title.
  // Its burst history stays, since that time was really spent.
  ipcMain.handle('ship:toInbox', (_e, id: string): Reply => {
    if (store.get().burst?.shipId === id) {
      finishBurst(store, 'parked');
      hooks.setMiniTimer?.(false);
    }
    const state = store.get();
    const index = state.ships.findIndex((x) => x.id === id);
    if (index === -1) return fail('That ship is gone.');
    const ship = structuredClone(state.ships[index]);
    const source = ship.ideaId ? state.ideas.find((i) => i.id === ship.ideaId) : undefined;
    const prevStatus = source?.status;
    const created: Idea | null = source
      ? null
      : {
          id: Store.id(),
          text: ship.title,
          sourceLink: '',
          tag: 'own',
          status: 'inbox',
          createdAt: new Date().toISOString(),
        };
    store.update((s) => {
      s.ships = s.ships.filter((x) => x.id !== id);
      if (created) s.ideas.unshift(created);
      else {
        const idea = s.ideas.find((i) => i.id === ship.ideaId);
        if (idea) idea.status = 'inbox';
      }
    });
    undo = (s) => {
      restoreAt(s.ships, ship, index);
      if (created) s.ideas = s.ideas.filter((i) => i.id !== created.id);
      else {
        const idea = s.ideas.find((i) => i.id === ship.ideaId);
        if (idea && prevStatus) idea.status = prevStatus;
      }
    };
    return ok();
  });

  ipcMain.handle('ship:addUrl', (_e, input: { id: string; url: string }): Reply => {
    if (!isPublicUrl(input?.url ?? '')) {
      return fail('That needs to be a public http(s) link - a domain, not localhost or an IP.');
    }
    const url = normalizeUrl(input.url);
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (!ship) return;
      if (!ship.urls.includes(url)) ship.urls.push(url);
      if (ship.status !== 'shipped') {
        ship.status = 'shipped';
        ship.shippedAt = new Date().toISOString();
      }
      // Keep a running burst in step. Without this the 2:00 checkpoint keeps
      // demanding a link for something already live, and the burst logs parked.
      if (s.burst?.shipId === ship.id) s.burst.shipped = true;
    });
    return ok();
  });

  ipcMain.handle('ship:removeUrl', (_e, input: { id: string; url: string }): Reply => {
    store.update((s) => {
      const ship = s.ships.find((x) => x.id === input.id);
      if (!ship) return;
      ship.urls = ship.urls.filter((u) => u !== input.url);
      // The link is what made it shipped. Taking the last one back during the
      // burst (a typo'd link, say) undoes the ship so it can be shipped again.
      if (ship.urls.length === 0 && s.burst?.shipId === ship.id && s.burst.shipped) {
        s.burst.shipped = false;
        ship.status = 'active';
        ship.shippedAt = null;
      }
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
        snoozeUntil: null,
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
    if (!isPublicUrl(url ?? '')) {
      return fail('Paste a public http(s) link - that is what makes it shipped.');
    }
    const clean = normalizeUrl(url);
    store.update((s) => {
      if (!s.burst) return;
      s.burst.shipped = true;
      s.burst.snoozeUntil = null;
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

  ipcMain.handle('burst:snooze', (_e, minutes: unknown): Reply => {
    // snooze(0) clears it - that is the "Ship it now" button bringing the
    // checkpoint straight back.
    const raw = typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : 5;
    const mins = Math.min(raw, 60);
    store.update((s) => {
      if (!s.burst) return;
      s.burst.snoozeUntil =
        mins > 0 ? new Date(Date.now() + mins * 60_000).toISOString() : null;
    });
    return ok();
  });

  ipcMain.handle('burst:setMini', (_e, on: boolean): Reply => {
    store.update((s) => {
      if (s.burst) s.burst.miniTimer = Boolean(on);
    });
    hooks.setMiniTimer?.(Boolean(on));
    return ok();
  });

  ipcMain.handle('burst:end', (_e, input: unknown): Reply => {
    const { outcome, blockedReason } = (input ?? {}) as {
      outcome?: BurstOutcome;
      blockedReason?: string;
    };
    const resolved: BurstOutcome = outcome === 'shipped' ? 'shipped' : 'parked';
    if (!finishBurst(store, resolved, Date.now(), blockedReason ?? '')) return fail('No burst running.');
    hooks.setMiniTimer?.(false);
    return ok();
  });

  // ---------- Settings & misc ----------
  ipcMain.handle('settings:update', (_e, patch: unknown): Reply => {
    const clean = settingsPatch(patch);
    store.update((s) => {
      Object.assign(s.settings, clean);
    });
    hooks.applyHotkey?.();
    hooks.applyTheme?.();
    return ok();
  });

  ipcMain.handle('shell:open', async (_e, url: string) => {
    if (!isPublicUrl(url ?? '')) return false;
    await shell.openExternal(normalizeUrl(url));
    return true;
  });

  ipcMain.handle('window:openCapture', () => {
    hooks.openCapture?.();
  });

  ipcMain.handle('window:closeCapture', () => {
    hooks.closeCapture?.();
  });

  ipcMain.handle('window:showMain', () => {
    hooks.showMain?.();
  });

  // Only ever moves the window that asked, by a small step.
  ipcMain.on('window:moveMini', (e, dx: unknown, dy: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || typeof dx !== 'number' || typeof dy !== 'number') return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
  });

  ipcMain.handle('export:markdown', async () => {
    return (await hooks.exportMarkdown?.()) ?? { ok: false, error: 'Export is unavailable.' };
  });
}

export function broadcastState(store: Store): void {
  const state = store.get();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('state:changed', state);
  }
}
