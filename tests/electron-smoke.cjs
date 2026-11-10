/**
 * Integration smoke test, run under Electron (npm run test:electron).
 *
 * The unit suite covers the pure logic; this covers the parts only a real
 * Electron process can show: that the preload bridge still reaches a SANDBOXED
 * renderer, that the React app boots and loads state through it, and that the
 * IPC handlers enforce their own rules when called the way the UI calls them.
 *
 * It runs against a throwaway userData directory, so your real board is never
 * touched.
 */
const { app, BrowserWindow, Menu, nativeTheme } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'burst-board-test-'));
app.setPath('userData', tmp);

let pass = 0;
let fail = 0;
const t = (name, cond, extra = '') => {
  if (!cond) fail += 1;
  else pass += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};

const DATA = path.join(tmp, 'burst-board-data.json');
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// A board with one active ship, and a burst that has been running for nine
// hours - the "forgot it overnight" case.
fs.writeFileSync(
  DATA,
  JSON.stringify({
    version: 1,
    ideas: [],
    ships: [
      { id: 'ship-1', ideaId: null, title: 'Test ship', liveIn2h: 'a thing', where: 'github',
        whereOther: '', uglyV1: '', status: 'active', createdAt: hoursAgo(10),
        shippedAt: null, urls: [], win: '', v2: '' },
    ],
    burst: {
      id: 'burst-1', shipId: 'ship-1', startedAt: hoursAgo(9), pausedMs: 0, pausedAt: null,
      shipped: false, firedCheckpoint: false, firedLogPrompt: false, miniTimer: false,
      // snoozeUntil deliberately absent: this is a v1 file, the migration adds it.
    },
    history: [],
    settings: { notificationsEnabled: true, reminderEnabled: false, reminderDay: 0,
      reminderTime: '10:00', lastReminderDate: null, globalHotkeyEnabled: false },
  }),
);

const { Store } = require(path.join(ROOT, 'dist-electron/electron/store.js'));
const { registerIpc, finishBurst, STALE_GRACE_MS } = require(path.join(ROOT, 'dist-electron/electron/ipc.js'));
const { elapsedMs, BURST_END_MS } = require(path.join(ROOT, 'dist-electron/shared/burst.js'));

app.whenReady().then(async () => {
  const store = new Store();

  // ---- migration + version ----
  t('v1 file migrated to the current version', store.get().version === 2,
    'version=' + store.get().version);
  t('migration filled in the new snoozeUntil field',
    store.get().burst && store.get().burst.snoozeUntil === null);
  t('backup written on load', fs.existsSync(DATA + '.bak'));

  // ---- stale burst cleanup (what main.ts does on launch) ----
  const stale = elapsedMs(store.get().burst) >= BURST_END_MS + STALE_GRACE_MS;
  t('a 9-hour-old burst is recognised as stale', stale);
  finishBurst(store, 'parked');
  t('stale burst cleared', store.get().burst === null);
  t('stale burst still reached the history', store.get().history.length === 1);
  t('stale burst minutes capped at four hours', store.get().history[0].minutes === 240,
    'minutes=' + store.get().history[0].minutes);

  registerIpc(store, { broadcast: () => {}, setMiniTimer: () => {}, applyHotkey: () => {},
    refreshTray: () => {}, exportMarkdown: async () => ({ ok: false, canceled: true }) });

  // ---- the real preload, in a SANDBOXED renderer ----
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'dist-electron/electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await win.loadFile(path.join(ROOT, 'dist/index.html'));
  await new Promise((r) => setTimeout(r, 1500));

  const js = (code) => win.webContents.executeJavaScript(code);

  const bridge = await js(`({
    present: typeof window.burst === 'object' && window.burst !== null,
    sections: window.burst ? Object.keys(window.burst).sort() : [],
    hasSnooze: !!(window.burst && typeof window.burst.burst.snooze === 'function'),
  })`);
  t('preload bridge reaches a sandboxed renderer', bridge.present, 'sections=' + bridge.sections.join(','));
  t('new snooze method is exposed', bridge.hasSnooze);

  const booted = await js(`({
    brand: !!document.querySelector('.brand'),
    stillLoading: document.body.innerText.includes('Loading your board'),
    tabs: [...document.querySelectorAll('.tab')].map(e => e.textContent.replace(/[0-9●]/g,'').trim()).filter(Boolean),
  })`);
  t('React app rendered under the sandbox', booted.brand);
  t('state loaded through the bridge', !booted.stillLoading);
  t('all five tabs present', booted.tabs.length >= 5, 'tabs=' + booted.tabs.join('|'));

  // ---- theme plumbing: settings -> nativeTheme -> prefers-color-scheme -> CSS ----
  nativeTheme.themeSource = 'dark';
  await new Promise((r) => setTimeout(r, 250));
  const darkBg = await js('getComputedStyle(document.body).backgroundColor');
  nativeTheme.themeSource = 'light';
  await new Promise((r) => setTimeout(r, 250));
  const lightBg = await js('getComputedStyle(document.body).backgroundColor');
  const lightText = await js('getComputedStyle(document.body).color');
  t('dark theme paints the dark background', darkBg === 'rgb(11, 13, 18)', darkBg);
  t('light theme repaints from the light palette', lightBg === 'rgb(245, 247, 251)', lightBg);
  t('light theme uses dark text', lightText === 'rgb(20, 26, 40)', lightText);
  nativeTheme.themeSource = 'dark';

  await js("window.burst.settings.update({ theme: 'light' })");
  t('a theme choice is stored', store.get().settings.theme === 'light');
  await js("window.burst.settings.update({ theme: 'chartreuse' })");
  t('a bogus theme is rejected', store.get().settings.theme === 'light',
    'theme=' + store.get().settings.theme);

  // ---- the application menu ----
  const { buildAppMenu } = require(path.join(ROOT, 'dist-electron/electron/menu.js'));
  buildAppMenu({
    openCapture: () => {}, startBurst: () => {}, showMain: () => {},
    exportMarkdown: () => {}, dataFile: () => DATA,
  });
  const menu = Menu.getApplicationMenu();
  const top = menu.items.map((m) => m.label || m.role);
  // A custom menu replaces Electron's default one, and copy/paste/undo live in
  // the Edit role. Losing it makes every text field unusable.
  t('menu keeps an Edit menu, so copy and paste still work',
    menu.items.some((m) => m.role === 'editMenu' || /^edit$/i.test(m.label)), 'top=' + top.join(','));
  t('menu has the Burst and Go sections', top.includes('Burst') && top.includes('Go'));
  const go = menu.items.find((m) => m.label === 'Go');
  t('Go has a shortcut for each of the five tabs',
    go.submenu.items.filter((i) => /^(CmdOrCtrl|Command)\+[1-5]$/.test(i.accelerator || '')).length === 5);

  // ---- ship:update allowlist: the invariant must hold ----
  await js(`window.burst.ships.update('ship-1', { status: 'shipped', shippedAt: '2020-01-01T00:00:00.000Z', urls: ['http://localhost:3000'] })`);
  const s1 = store.get().ships.find((x) => x.id === 'ship-1');
  t('a patch cannot mark a ship shipped without a URL', s1.status !== 'shipped', 'status=' + s1.status);
  t('a patch cannot set shippedAt', s1.shippedAt === null);
  t('a patch cannot inject URLs', s1.urls.length === 0);

  const titled = await js(`window.burst.ships.update('ship-1', { title: 'Renamed' })`);
  t('a patch still applies the fields it is allowed to', titled.ok &&
    store.get().ships.find((x) => x.id === 'ship-1').title === 'Renamed');

  // ---- settings allowlist ----
  await js(`window.burst.settings.update({ reminderTime: 'not-a-time', reminderDay: 99, bogusKey: 'x' })`);
  const set = store.get().settings;
  t('a bad reminderTime is rejected, not stored', set.reminderTime === '10:00', 'time=' + set.reminderTime);
  t('an out-of-range reminderDay is rejected', set.reminderDay === 0, 'day=' + set.reminderDay);
  t('an unknown settings key is dropped', !('bogusKey' in set));
  await js(`window.burst.settings.update({ reminderTime: '9:05' })`);
  t('a valid short time is normalised', store.get().settings.reminderTime === '09:05',
    'time=' + store.get().settings.reminderTime);

  // ---- public URL enforcement, through the real IPC path ----
  const bad = await js(`window.burst.burst.start('ship-1').then(() => window.burst.burst.shipNow('http://127.1'))`);
  t('shipNow rejects a non-public link', bad.ok === false, bad.error || '');
  const good = await js(`window.burst.burst.shipNow('example.com/thing')`);
  t('shipNow accepts a public link', good.ok === true);
  t('the link is stored with a scheme',
    store.get().ships.find((x) => x.id === 'ship-1').urls[0] === 'https://example.com/thing');

  // ---- snooze is persisted on the session ----
  await js(`window.burst.burst.snooze(5)`);
  const snoozed = store.get().burst.snoozeUntil;
  t('snooze is written to the session, not the view', typeof snoozed === 'string', 'until=' + snoozed);
  store.saveNow();
  t('snooze survives a reload from disk',
    typeof JSON.parse(fs.readFileSync(DATA, 'utf8')).burst.snoozeUntil === 'string');
  await js(`window.burst.burst.snooze(0)`);
  t('snooze(0) clears it for "Ship it now"', store.get().burst.snoozeUntil === null);

  // ---- addUrl keeps the running burst in step ----
  await js(`window.burst.burst.end('parked').then(() => window.burst.burst.start('ship-1'))`);
  await js(`window.burst.ships.addUrl('ship-1', 'https://example.com/second')`);
  t('addUrl marks the running burst as shipped', store.get().burst.shipped === true);

  // ---- deleting a ship mid-burst closes the burst out ----
  const before = store.get().history.length;
  await js(`window.burst.ships.remove('ship-1')`);
  t('deleting a ship mid-burst clears the burst', store.get().burst === null);
  t('deleting a ship mid-burst still logs it', store.get().history.length === before + 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(fail ? 1 : 0);
});
