import { contextBridge, ipcRenderer } from 'electron';
import type { BurstApi } from '../shared/api';

/**
 * Typed as BurstApi on purpose: the contract lives in shared/api.ts and both
 * this bridge and the renderer are checked against it, so the two can never
 * drift apart without a compile error.
 */
const api: BurstApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  dataFile: () => ipcRenderer.invoke('app:dataFile'),

  onStateChanged: (cb) => {
    const handler = (_e: unknown, state: Parameters<typeof cb>[0]) => cb(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },

  /** Main process asks the UI to go somewhere (tray / hotkey / notification). */
  onNavigate: (cb) => {
    const handler = (_e: unknown, route: string) => cb(route);
    ipcRenderer.on('app:navigate', handler);
    return () => ipcRenderer.removeListener('app:navigate', handler);
  },

  ideas: {
    add: (input) => ipcRenderer.invoke('idea:add', input),
    update: (id, patch) => ipcRenderer.invoke('idea:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('idea:delete', id),
  },

  ships: {
    create: (input) => ipcRenderer.invoke('ship:create', input),
    update: (id, patch) => ipcRenderer.invoke('ship:update', { id, patch }),
    park: (id, blockedReason) => ipcRenderer.invoke('ship:park', { id, blockedReason }),
    unpark: (id) => ipcRenderer.invoke('ship:unpark', id),
    remove: (id) => ipcRenderer.invoke('ship:delete', id),
    addUrl: (id, url) => ipcRenderer.invoke('ship:addUrl', { id, url }),
    removeUrl: (id, url) => ipcRenderer.invoke('ship:removeUrl', { id, url }),
  },

  burst: {
    start: (shipId) => ipcRenderer.invoke('burst:start', shipId),
    pause: () => ipcRenderer.invoke('burst:pause'),
    resume: () => ipcRenderer.invoke('burst:resume'),
    shipNow: (url) => ipcRenderer.invoke('burst:shipNow', url),
    ackCheckpoint: () => ipcRenderer.invoke('burst:ackCheckpoint'),
    ackLogPrompt: () => ipcRenderer.invoke('burst:ackLogPrompt'),
    snooze: (minutes) => ipcRenderer.invoke('burst:snooze', minutes),
    setMini: (on) => ipcRenderer.invoke('burst:setMini', on),
    end: (outcome, blockedReason) => ipcRenderer.invoke('burst:end', { outcome, blockedReason }),
  },

  settings: {
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
  },

  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  openCapture: () => ipcRenderer.invoke('window:openCapture'),
  closeCapture: () => ipcRenderer.invoke('window:closeCapture'),
  exportMarkdown: () => ipcRenderer.invoke('export:markdown'),
};

contextBridge.exposeInMainWorld('burst', api);
