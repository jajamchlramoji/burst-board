import { Menu, Tray, app, nativeImage } from 'electron';
import path from 'node:path';
import { Store } from './store';
import { BURST_END_MS, elapsedMs, formatShort } from '../shared/burst';

export interface TrayDeps {
  openCapture: () => void;
  startBurst: () => void;
  showMain: (route?: string) => void;
}

let tray: Tray | null = null;

function iconPath(): string {
  return path.join(__dirname, '../../assets/tray/trayTemplate.png');
}

export function createTray(store: Store, deps: TrayDeps): void {
  if (tray) return;
  const image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) {
    console.warn(`[burst-board] menu bar icon missing at ${iconPath()}`);
  }
  image.setTemplateImage(true);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Burst Board');
  refreshTray(store, deps);
}

export function refreshTray(store: Store, deps: TrayDeps): void {
  if (!tray) return;
  const state = store.get();
  const burst = state.burst;
  const ship = burst ? state.ships.find((s) => s.id === burst.shipId) : undefined;
  const active = state.ships.filter((s) => s.status === 'active').length;

  // While a burst runs, the menu bar shows the time left.
  if (burst) {
    const left = Math.max(0, BURST_END_MS - elapsedMs(burst));
    tray.setTitle(burst.pausedAt ? ' paused' : ` ${formatShort(left)}`);
  } else {
    tray.setTitle('');
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Capture idea',
      accelerator: 'CommandOrControl+Shift+B',
      click: () => deps.openCapture(),
    },
    {
      label: burst ? `Burst running: ${ship?.title ?? ''}`.slice(0, 50) : 'Start burst',
      click: () => deps.startBurst(),
    },
    { type: 'separator' },
    {
      label: burst
        ? burst.pausedAt
          ? 'Burst paused'
          : `${formatShort(Math.max(0, BURST_END_MS - elapsedMs(burst)))} left in this burst`
        : `${active} active ${active === 1 ? 'ship' : 'ships'}`,
      enabled: false,
    },
    { type: 'separator' },
    { label: 'Open Burst Board', click: () => deps.showMain() },
    { label: 'Ship log', click: () => deps.showMain('log') },
    { type: 'separator' },
    { label: 'Quit Burst Board', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
