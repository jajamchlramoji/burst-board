import { Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

export interface MenuDeps {
  openCapture: () => void;
  startBurst: () => void;
  showMain: (route?: string) => void;
  exportMarkdown: () => void;
  dataFile: () => string;
}

/**
 * Without an application menu the app runs on Electron's default one, which
 * means no shortcuts of its own. The editMenu and windowMenu roles have to stay
 * in: copy, paste, undo and select-all come from them, and text fields are
 * unusable without them.
 */
export function buildAppMenu(deps: MenuDeps): void {
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'Burst',
      submenu: [
        // No accelerator here on purpose: CmdOrCtrl+Shift+B is registered as a
        // global shortcut, and listing it twice can fire the window twice.
        { label: 'Capture idea  (⌘⇧B)', click: () => deps.openCapture() },
        { label: 'New idea in Inbox', accelerator: 'CmdOrCtrl+N', click: () => deps.showMain('new-idea') },
        { label: 'Start a burst', accelerator: 'CmdOrCtrl+B', click: () => deps.startBurst() },
        { type: 'separator' },
        {
          label: 'Export ship log…',
          accelerator: 'CmdOrCtrl+E',
          click: () => deps.exportMarkdown(),
        },
        { label: 'Reveal data file in Finder', click: () => shell.showItemInFolder(deps.dataFile()) },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Inbox', accelerator: 'CmdOrCtrl+1', click: () => deps.showMain('inbox') },
        { label: 'Shrink', accelerator: 'CmdOrCtrl+2', click: () => deps.showMain('shrink') },
        { label: 'Spin', accelerator: 'CmdOrCtrl+3', click: () => deps.showMain('spin') },
        { label: 'Burst', accelerator: 'CmdOrCtrl+4', click: () => deps.showMain('burst') },
        { label: 'Ship log', accelerator: 'CmdOrCtrl+5', click: () => deps.showMain('log') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => deps.showMain('settings') },
        {
          label: 'Keyboard shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => deps.showMain('shortcuts'),
        },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
