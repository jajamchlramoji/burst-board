import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, BurstOutcome, Idea, IdeaTag, Settings, Ship, ShipWhere } from '../shared/types';

type Reply = { ok: true; state: AppState } | { ok: false; error: string };

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  dataFile: (): Promise<string> => ipcRenderer.invoke('app:dataFile'),

  onStateChanged: (cb: (state: AppState) => void): (() => void) => {
    const handler = (_e: unknown, state: AppState) => cb(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },

  /** Main process asks the UI to go somewhere (tray / hotkey / notification click). */
  onNavigate: (cb: (route: string) => void): (() => void) => {
    const handler = (_e: unknown, route: string) => cb(route);
    ipcRenderer.on('app:navigate', handler);
    return () => ipcRenderer.removeListener('app:navigate', handler);
  },

  ideas: {
    add: (input: { text: string; sourceLink?: string; tag?: IdeaTag }): Promise<Reply> =>
      ipcRenderer.invoke('idea:add', input),
    update: (id: string, patch: Partial<Idea>): Promise<Reply> =>
      ipcRenderer.invoke('idea:update', { id, patch }),
    remove: (id: string): Promise<Reply> => ipcRenderer.invoke('idea:delete', id),
  },

  ships: {
    create: (input: {
      ideaId: string | null;
      title: string;
      liveIn2h: string;
      where: ShipWhere;
      whereOther?: string;
      uglyV1?: string;
    }): Promise<Reply> => ipcRenderer.invoke('ship:create', input),
    update: (id: string, patch: Partial<Ship>): Promise<Reply> =>
      ipcRenderer.invoke('ship:update', { id, patch }),
    park: (id: string): Promise<Reply> => ipcRenderer.invoke('ship:park', id),
    unpark: (id: string): Promise<Reply> => ipcRenderer.invoke('ship:unpark', id),
    remove: (id: string): Promise<Reply> => ipcRenderer.invoke('ship:delete', id),
    addUrl: (id: string, url: string): Promise<Reply> => ipcRenderer.invoke('ship:addUrl', { id, url }),
    removeUrl: (id: string, url: string): Promise<Reply> =>
      ipcRenderer.invoke('ship:removeUrl', { id, url }),
  },

  burst: {
    start: (shipId: string): Promise<Reply> => ipcRenderer.invoke('burst:start', shipId),
    pause: (): Promise<Reply> => ipcRenderer.invoke('burst:pause'),
    resume: (): Promise<Reply> => ipcRenderer.invoke('burst:resume'),
    shipNow: (url: string): Promise<Reply> => ipcRenderer.invoke('burst:shipNow', url),
    ackCheckpoint: (): Promise<Reply> => ipcRenderer.invoke('burst:ackCheckpoint'),
    ackLogPrompt: (): Promise<Reply> => ipcRenderer.invoke('burst:ackLogPrompt'),
    setMini: (on: boolean): Promise<Reply> => ipcRenderer.invoke('burst:setMini', on),
    end: (outcome: BurstOutcome): Promise<Reply> => ipcRenderer.invoke('burst:end', outcome),
  },

  settings: {
    update: (patch: Partial<Settings>): Promise<Reply> => ipcRenderer.invoke('settings:update', patch),
  },

  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:open', url),
  openCapture: (): Promise<void> => ipcRenderer.invoke('window:openCapture'),
  closeCapture: (): Promise<void> => ipcRenderer.invoke('window:closeCapture'),
  exportMarkdown: (): Promise<string | null> => ipcRenderer.invoke('export:markdown'),
};

contextBridge.exposeInMainWorld('burst', api);

export type BurstApi = typeof api;
