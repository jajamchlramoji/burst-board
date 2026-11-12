import { BrowserWindow, app, globalShortcut, nativeTheme, powerMonitor, screen, shell } from 'electron';
import path from 'node:path';
import { Store } from './store';
import { STALE_GRACE_MS, broadcastState, finishBurst, registerIpc } from './ipc';
import { BURST_END_MS, elapsedMs } from '../shared/burst';
import { exportMarkdown } from './export';
import { startScheduler } from './notify';
import { createTray, refreshTray } from './tray';
import { buildAppMenu } from './menu';

const CAPTURE_HOTKEY = 'CommandOrControl+Shift+B';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIR = path.join(__dirname, '../../dist');
const PRELOAD = path.join(__dirname, 'preload.js');

let store: Store;
let mainWindow: BrowserWindow | null = null;
let captureWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;

/**
 * Two copies of the app would read-modify-write the same JSON file - and the
 * same .tmp file - so only the first one runs. Starting a second hands focus
 * back to the copy that is already going, then exits.
 */
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

/** The one place the OS is told which palette to use. The stylesheet then
 *  follows prefers-color-scheme, so every window changes at once. */
function applyTheme(): void {
  nativeTheme.themeSource = store.get().settings.theme;
}

/** Window chrome has to match, or a light window flashes dark while loading. */
function chromeColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#2b2d31' : '#f5f6f8';
}

/** Renderer settings every window shares. Sandboxed: the preload only needs
 *  contextBridge and ipcRenderer, both of which work inside the sandbox. */
function rendererPrefs() {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  } as const;
}

/**
 * The preload is attached to every window, so a window that navigated to a
 * remote page would hand that page the entire burst API. Nothing in this app
 * navigates: links go to the real browser instead.
 */
function harden(win: BrowserWindow): void {
  const devOrigin = DEV_URL ? new URL(DEV_URL).origin : null;
  win.webContents.on('will-navigate', (event, url) => {
    const internal =
      url.startsWith('file://') || (devOrigin !== null && url.startsWith(devOrigin));
    if (internal) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // Nothing here needs a <webview>, and one would arrive with weaker settings.
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

/** One renderer bundle, routed by hash. */
function loadRoute(win: BrowserWindow, route: string): void {
  if (DEV_URL) {
    void win.loadURL(`${DEV_URL}#${route}`);
  } else {
    void win.loadFile(path.join(RENDERER_DIR, 'index.html'), { hash: route });
  }
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Burst Board',
    backgroundColor: chromeColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: rendererPrefs(),
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    mainWindow = null;
  });

  harden(win);

  loadRoute(win, '/');
  mainWindow = win;
  return win;
}

export function showMainWindow(route?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win = createMainWindow();
    if (route) {
      win.webContents.once('did-finish-load', () => win.webContents.send('app:navigate', route));
    }
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (route) mainWindow.webContents.send('app:navigate', route);
}

export function openCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show();
    captureWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 560,
    height: 300,
    resizable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: chromeColor(),
    webPreferences: rendererPrefs(),
  });
  let closeOnBlur = false;
  win.once('ready-to-show', () => {
    win.center();
    // The hotkey can fire while another app is frontmost: take focus so the
    // very first keystroke lands in the idea field.
    app.focus({ steal: true });
    win.show();
    win.focus();
    setTimeout(() => {
      closeOnBlur = true;
    }, 500);
  });
  win.on('blur', () => {
    if (closeOnBlur && !win.isDestroyed() && !win.webContents.isDevToolsOpened()) win.close();
  });
  win.on('closed', () => {
    captureWindow = null;
  });
  harden(win);
  loadRoute(win, '/capture');
  captureWindow = win;
}

export function closeCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close();
}

export function setMiniTimer(on: boolean): void {
  if (!on) {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    miniWindow = null;
    return;
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    return;
  }
  const win = new BrowserWindow({
    width: 208,
    height: 116,
    resizable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    maximizable: false,
    minimizable: false,
    backgroundColor: chromeColor(),
    webPreferences: rendererPrefs(),
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => {
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    win.setPosition(workArea.x + workArea.width - 228, workArea.y + 20);
    win.show();
  });
  win.on('closed', () => {
    miniWindow = null;
  });
  harden(win);
  loadRoute(win, '/mini');
  miniWindow = win;
}

/** Register or release the global capture hotkey to match settings. */
function applyHotkey(): void {
  globalShortcut.unregister(CAPTURE_HOTKEY);
  if (!store.get().settings.globalHotkeyEnabled) return;
  const registered = globalShortcut.register(CAPTURE_HOTKEY, () => openCaptureWindow());
  if (!registered) {
    console.warn(`[burst-board] ${CAPTURE_HOTKEY} is taken by another app; capture hotkey is off.`);
  }
}

const trayDeps = {
  openCapture: () => openCaptureWindow(),
  startBurst: () => startBurstFlow(),
  showMain: (route?: string) => showMainWindow(route),
};

/**
 * A burst left running well past 4:00 belongs to an earlier session - forgotten
 * overnight, or the laptop slept through it. Close it out so it still reaches
 * the ship log and today's burst can start. The grace period means finishing
 * normally at 4:00 still leaves time to write the log.
 */
function endStaleBurst(): boolean {
  const burst = store.get().burst;
  if (!burst) return false;
  if (elapsedMs(burst) < BURST_END_MS + STALE_GRACE_MS) return false;
  finishBurst(store, 'parked');
  setMiniTimer(false);
  console.warn('[burst-board] a burst was left running past four hours - logged it and cleared it.');
  return true;
}

/**
 * A burst measures wall-clock time so it survives a quit and restart, which
 * also meant a closed lid counted as hours of work. Sleep is folded into the
 * same paused total the pause button uses.
 */
let sleepStartedAt: number | null = null;

function trackSleep(): void {
  powerMonitor.on('suspend', () => {
    const burst = store.get().burst;
    // Already paused by hand? The pause is doing the accounting.
    if (burst && !burst.pausedAt) sleepStartedAt = Date.now();
  });

  powerMonitor.on('resume', () => {
    const slept = sleepStartedAt === null ? 0 : Date.now() - sleepStartedAt;
    sleepStartedAt = null;
    if (slept > 0) {
      store.update((s) => {
        if (s.burst && !s.burst.pausedAt) s.burst.pausedMs += slept;
      });
    }
    endStaleBurst();
    broadcastState(store);
    refreshTray(store, trayDeps);
  });
}

/** Tray "Start burst": go straight to the spin wheel, or to a running burst. */
function startBurstFlow(): void {
  showMainWindow(store.get().burst ? 'burst' : 'spin');
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return;
  store = new Store();
  applyTheme();

  registerIpc(store, {
    broadcast: () => broadcastState(store),
    openCapture: openCaptureWindow,
    closeCapture: closeCaptureWindow,
    setMiniTimer,
    exportMarkdown: () => exportMarkdown(store.get()),
    refreshTray: () => refreshTray(store, trayDeps),
    applyHotkey,
    applyTheme,
    startBurstFlow,
  });

  // Before any window reads it: yesterday's burst should not block today's.
  endStaleBurst();

  buildAppMenu({
    openCapture: openCaptureWindow,
    startBurst: startBurstFlow,
    showMain: (route?: string) => showMainWindow(route),
    exportMarkdown: () => void exportMarkdown(store.get()),
    dataFile: () => store.dataFile,
  });

  createMainWindow();
  createTray(store, trayDeps);
  applyHotkey();
  trackSleep();

  // Restore a mini timer that was open when the app last quit.
  if (store.get().burst?.miniTimer) setMiniTimer(true);

  startScheduler(store, {
    broadcast: () => broadcastState(store),
    onShipCheckpoint: () => showMainWindow('burst'),
    onLogPrompt: () => showMainWindow('burst'),
    onWeeklyReminder: () => showMainWindow('shrink'),
  });

  // Keep the menu bar clock honest, and sweep up a burst that ran away.
  setInterval(() => {
    if (endStaleBurst()) broadcastState(store);
    refreshTray(store, trayDeps);
  }, 30_000);

  app.on('activate', () => showMainWindow());
});

app.on('second-instance', () => {
  app.focus({ steal: true });
  showMainWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  store?.saveNow();
});
