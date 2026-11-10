import { BrowserWindow, app, globalShortcut, nativeTheme, shell } from 'electron';
import path from 'node:path';
import { Store } from './store';
import { broadcastState, registerIpc } from './ipc';
import { exportMarkdown } from './export';
import { startScheduler } from './notify';
import { createTray, refreshTray } from './tray';

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
    backgroundColor: '#0b0d12',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    mainWindow = null;
  });

  // Links always open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

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
    backgroundColor: '#11141b',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
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
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => {
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    win.setPosition(workArea.x + workArea.width - 228, workArea.y + 20);
    win.show();
  });
  win.on('closed', () => {
    miniWindow = null;
  });
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

/** Tray "Start burst": go straight to the spin wheel, or to a running burst. */
function startBurstFlow(): void {
  showMainWindow(store.get().burst ? 'burst' : 'spin');
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return;
  nativeTheme.themeSource = 'dark';
  store = new Store();

  const trayDeps = {
    openCapture: openCaptureWindow,
    startBurst: startBurstFlow,
    showMain: (route?: string) => showMainWindow(route),
  };

  registerIpc(store, {
    broadcast: () => broadcastState(store),
    openCapture: openCaptureWindow,
    closeCapture: closeCaptureWindow,
    setMiniTimer,
    exportMarkdown: () => exportMarkdown(store.get()),
    refreshTray: () => refreshTray(store, trayDeps),
    applyHotkey,
    startBurstFlow,
  });

  createMainWindow();
  createTray(store, trayDeps);
  applyHotkey();

  // Restore a mini timer that was open when the app last quit.
  if (store.get().burst?.miniTimer) setMiniTimer(true);

  startScheduler(store, {
    broadcast: () => broadcastState(store),
    onShipCheckpoint: () => showMainWindow('burst'),
    onLogPrompt: () => showMainWindow('burst'),
    onWeeklyReminder: () => showMainWindow('shrink'),
  });

  // Keep the menu bar clock honest.
  setInterval(() => refreshTray(store, trayDeps), 30_000);

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
