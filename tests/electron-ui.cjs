/**
 * UI stress test, run under Electron (npm run test:ui).
 *
 * Clicks through the real built app - Inbox, Shrink, Spin, Burst, the mini
 * timer, Ship log, Settings - with the real IPC handlers behind it, and checks
 * the stored board after every step. Runs against a throwaway userData folder.
 * Set SHOTS=/some/folder to also save screenshots along the way.
 */
const { app, BrowserWindow, nativeTheme } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'burst-stress-'));
app.setPath('userData', tmp);

let pass = 0;
let fail = 0;
const t = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  -> ' + extra : ''}`);
};

const { Store } = require(path.join(ROOT, 'dist-electron/electron/store.js'));
const { registerIpc, broadcastState } = require(path.join(ROOT, 'dist-electron/electron/ipc.js'));

const HELPERS = `
window.T = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  btn: (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text)),
  async click(text, root) { const b = T.btn(text, root); if (!b) throw new Error('no button: ' + text); b.click(); await T.sleep(160); },
  async tab(name) { const b = [...document.querySelectorAll('.tab')].find((x) => x.textContent.replace(/[0-9●]/g, '').trim() === name); if (!b) throw new Error('no tab ' + name); b.click(); await T.sleep(200); },
  async type(el, v) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) throw new Error('no field');
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await T.sleep(50);
  },
  async key(k, o = {}, target) { (target || window).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o })); await T.sleep(160); },
  toast: () => document.querySelector('.toast')?.textContent || '',
  text: (sel) => document.querySelector(sel)?.textContent || '',
};
true`;

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  const store = new Store();
  const S = () => store.get();
  let showMainCalls = 0;
  registerIpc(store, {
    broadcast: () => broadcastState(store),
    setMiniTimer: () => {},
    applyHotkey: () => {},
    applyTheme: () => { nativeTheme.themeSource = store.get().settings.theme; },
    refreshTray: () => {},
    openCapture: () => {},
    closeCapture: () => {},
    startBurstFlow: () => {},
    showMain: () => { showMainCalls++; },
    exportMarkdown: async () => ({ ok: false, canceled: true }),
  });

  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    show: false,
    backgroundColor: '#2b2d31',
    webPreferences: {
      preload: path.join(ROOT, 'dist-electron/electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  const errors = [];
  win.webContents.on('console-message', (ev) => {
    if (ev.level === 'error') errors.push(ev.message);
  });
  win.webContents.on('render-process-gone', (_e, d) => errors.push('renderer gone: ' + d.reason));
  await win.loadFile(path.join(ROOT, 'dist/index.html'));
  await new Promise((r) => setTimeout(r, 1200));
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const shot = async (name, w = win) => {
    if (!SHOTS) return;
    const img = await w.webContents.capturePage();
    fs.writeFileSync(path.join(SHOTS, name + '.png'), img.toPNG());
  };
  await js(HELPERS.replace(/true$/, ''));

  try {
    // ---------------- Inbox ----------------
    await js(`await T.tab('Inbox'); await T.key('Enter', {}, document.querySelector('input[aria-label="Idea"]'));`);
    t('empty idea is not saved', S().ideas.length === 0);
    t('empty capture says the safe-space line', (await js(`return T.toast()`)) === "Don't be shy, this is a safe space.", await js(`return T.toast()`));
    await js(`const el = document.querySelector('input[aria-label="Idea"]'); await T.type(el, 'An other idea'); const c = document.querySelector('.chip'); c.click(); await T.sleep(60); c.click(); await T.sleep(60); await T.key('Enter', {}, el);`);
    const other = S().ideas.find((i) => i.text === 'An other idea');
    t('chip cycles Own > FOMO > Other and saves Other', other?.tag === 'other', other?.tag);
    t('Other pill shows on the idea', (await js(`return [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('An other idea'))?.querySelector('.pill')?.textContent`)) === 'Other');
    await js(`const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('An other idea')); item.querySelector('button[aria-label="Delete"]').click(); await T.sleep(200);`);

    for (let i = 1; i <= 20; i++) {
      await js(`const el = document.querySelector('input[aria-label="Idea"]'); await T.type(el, 'Idea number ${i}'); await T.key('Enter', {}, el);`);
    }
    t('20 ideas captured with Enter', S().ideas.length === 20, S().ideas.length);

    await js(`
      const el = document.querySelector('input[aria-label="Idea"]');
      await T.type(el, 'Linear triage view');
      document.querySelector('.chip').click(); await T.sleep(80);
      document.querySelector('.icon-btn').click(); await T.sleep(120);
      await T.type('input[aria-label="Source link"]', 'https://linear.app/changelog');
      await T.click('Capture');`);
    const fomo = S().ideas.find((i) => i.text === 'Linear triage view');
    t('FOMO idea with link saved', fomo && fomo.tag === 'fomo' && fomo.sourceLink.includes('linear.app'), JSON.stringify(fomo && [fomo.tag, fomo.sourceLink]));
    t('capture line resets after save', (await js(`return document.querySelector('input[aria-label="Idea"]').value === '' && !document.querySelector('input[aria-label="Source link"]') && document.querySelector('.chip').textContent === 'Own'`)));

    // edit an idea
    await js(`
      const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Idea number 3'));
      item.querySelector('button[aria-label="Edit"]').click(); await T.sleep(160);
      const ta = document.querySelector('.card textarea'); await T.type(ta, 'Idea number 3 (edited)');
      await T.click('Save', document.querySelector('.card'));`);
    t('inline edit saves', S().ideas.some((i) => i.text === 'Idea number 3 (edited)'));

    // delete via X
    const before = S().ideas.length;
    const idx = S().ideas.findIndex((i) => i.text === 'Idea number 5');
    await js(`
      const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Idea number 5'));
      item.querySelector('button[aria-label="Delete"]').click(); await T.sleep(200);`);
    t('X deletes an idea', S().ideas.length === before - 1 && !S().ideas.some((i) => i.text === 'Idea number 5'));
    t('delete offers Undo', (await js(`return T.text('.toast.with-action span')`)) === 'Idea deleted.');
    await js(`await T.click('Undo'); await T.sleep(150);`);
    t('Undo puts the idea back where it was', S().ideas.length === before && S().ideas[idx]?.text === 'Idea number 5');
    await js(`await T.click('Undo');`).catch(() => {});
    t('a second Undo has nothing to undo', S().ideas.length === before);
    await js(`
      const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Idea number 5'));
      item.querySelector('button[aria-label="Delete"]').click(); await T.sleep(200);`);
    await shot('01-inbox');

    // ---------------- Shrink ----------------
    await js(`await T.tab('Shrink');`);
    const mkShip = async (title, live) =>
      js(`
        await T.type(document.querySelectorAll('.card input[type=text]')[0], ${JSON.stringify(title)});
        await T.type(document.querySelectorAll('.card textarea')[0], ${JSON.stringify(live)});
        await T.click('Add one-burst ship');`);
    await js(`await T.click('Add one-burst ship');`);
    t('ship without title is rejected', S().ships.length === 0);
    const ideaForShip = S().ideas.find((i) => i.text === 'Idea number 1');
    await js(`await T.type(document.querySelector('.card select'), ${JSON.stringify(ideaForShip.id)});`);
    await mkShip('Ship A', 'A thing live in two hours');
    t('ship created from an idea', S().ships.length === 1 && S().ships[0].ideaId === ideaForShip.id, JSON.stringify(S().ships.map((s) => s.title)));
    t('the source idea left the inbox', S().ideas.find((i) => i.id === ideaForShip.id)?.status !== 'inbox', S().ideas.find((i) => i.id === ideaForShip.id)?.status);
    for (const n of ['B', 'C', 'D', 'E']) await mkShip('Ship ' + n, 'Live thing ' + n);
    t('five active ships', S().ships.filter((s) => s.status === 'active').length === 5);
    await js(`
      const ins = document.querySelectorAll('.card input[type=text]');
      if (ins[0] && !ins[0].disabled) { await T.type(ins[0], 'Ship F'); await T.type(document.querySelectorAll('.card textarea')[0], 'x'); await T.click('Add one-burst ship'); }`);
    t('sixth active ship is refused', S().ships.length === 5, S().ships.length);

    // park with no reason, then with a reason
    await js(`
      const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Ship E'));
      await T.click('Park', item);
      await T.click('Park it');`);
    t('park without a reason is refused', S().ships.find((s) => s.title === 'Ship E').status === 'active');
    await js(`
      await T.type(document.querySelector('.card textarea[rows="2"]') || [...document.querySelectorAll('textarea')].pop(), 'Waiting on an API key');
      await T.click('Park it');`);
    const e = S().ships.find((s) => s.title === 'Ship E');
    t('park with a reason stores the blocker', e.status === 'parked' && e.blockedReason === 'Waiting on an API key', JSON.stringify([e.status, e.blockedReason]));
    t('blocker shows on the parked card', (await js(`return document.querySelector('.blocker')?.textContent || ''`)).includes('API key'));
    await js(`const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Ship E')); await T.click('Unpark', item);`);
    t('unpark returns it to active', S().ships.find((s) => s.title === 'Ship E').status === 'active');
    await js(`const item = [...document.querySelectorAll('.item')].find((x) => x.textContent.includes('Ship E')); item.querySelector('button[aria-label="Delete"]').click(); await T.sleep(200);`);
    t('X deletes a ship', !S().ships.some((s) => s.title === 'Ship E'));
    await shot('02-shrink');

    // ---------------- Spin -> Burst ----------------
    await js(`await T.tab('Spin'); document.activeElement && document.activeElement.blur(); await T.key(' ');`);
    const landed = await js(`for (let i = 0; i < 40 && !document.querySelector('.reel.landed'); i++) await T.sleep(200); return document.querySelector('.reel-row.win')?.textContent || ''`);
    t('Space spins and the reel lands on a ship', S().ships.some((s) => s.title === landed), landed);
    await shot('03-spin');
    await js(`await T.key('Enter', { metaKey: true }); await T.sleep(300);`);
    t('Cmd+Enter starts the burst on the landed ship', S().burst && S().ships.find((s) => s.id === S().burst.shipId)?.title === landed);
    const shipId = S().burst.shipId;
    const ship = () => S().ships.find((s) => s.id === shipId);
    await shot('04-burst');

    // mini timer window: x hides it, clicking opens the app
    await js(`await T.click('Mini timer');`);
    t('Mini timer turns on', S().burst.miniTimer === true);
    const openMini = async () => {
      const w = new BrowserWindow({ width: 228, height: 136, frame: false, transparent: true, show: false, webPreferences: { preload: path.join(ROOT, 'dist-electron/electron/preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      await w.loadFile(path.join(ROOT, 'dist/index.html'), { hash: '/mini' });
      await new Promise((r) => setTimeout(r, 800));
      return w;
    };
    const press = async (w, x, y, moveTo) => {
      // globalX/Y: hidden test windows report no screen position otherwise.
      const at = (px, py) => ({ x: px, y: py, globalX: 500 + px, globalY: 300 + py });
      w.webContents.sendInputEvent({ type: 'mouseDown', ...at(x, y), button: 'left', clickCount: 1 });
      if (moveTo) w.webContents.sendInputEvent({ type: 'mouseMove', ...at(moveTo[0], moveTo[1]), modifiers: ['leftButtonDown'] });
      const end = moveTo || [x, y];
      w.webContents.sendInputEvent({ type: 'mouseUp', ...at(end[0], end[1]), button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 300));
    };
    let mini = await openMini();
    const mjs = (code) => mini.webContents.executeJavaScript(`(async () => { ${code} })()`);
    t('mini shows the running ship', (await mjs(`return document.querySelector('.m-ship')?.textContent`)) === landed);
    t('mini page is see-through around the card', (await mjs(`return getComputedStyle(document.body).backgroundColor`)) === 'rgba(0, 0, 0, 0)');
    await shot('04b-mini', mini);
    await press(mini, 100, 70, [140, 90]);
    t('dragging the mini timer does not open the app', showMainCalls === 0 && S().burst.miniTimer === true);
    await press(mini, 100, 70);
    t('clicking anywhere on it opens the app', showMainCalls === 1, showMainCalls);
    t('and hides the mini timer', S().burst.miniTimer === false);
    mini.destroy();
    await js(`await T.click('Mini timer');`);
    mini = await openMini();
    await mjs(`document.querySelector('.m-hide').click(); await new Promise((r) => setTimeout(r, 200));`);
    t('the corner button only hides it', S().burst.miniTimer === false && showMainCalls === 1);
    mini.destroy();

    // pause / resume
    await js(`await T.key(' ');`);
    t('Space pauses', !!S().burst.pausedAt);
    await js(`await T.key(' ');`);
    t('Space resumes', !S().burst.pausedAt);

    // bad link
    await js(`await T.key('s', { metaKey: true }); await T.type('.modal input', 'hjabdiuadbied'); await T.click('It is live');`);
    t('a non-link does not ship', !S().burst.shipped && ship().status === 'active');
    t('the dialog says why', (await js(`return T.toast()`)).toLowerCase().includes('link'), await js(`return T.toast()`));

    // good link, double click
    await js(`await T.type('.modal input', 'https://github.com/me/thing'); const b = T.btn('It is live'); b.click(); b.click(); await T.sleep(400);`);
    t('a real link ships it', S().burst.shipped && ship().status === 'shipped' && ship().urls.length === 1, JSON.stringify(ship().urls));
    t('double click ships once', S().history.length === 0 && ship().urls.length === 1);
    t('celebration shows Shipped.', (await js(`return T.text('.modal h3')`)) === 'Shipped.');
    await shot('05-shipped-celebration');
    await js(`await T.sleep(1400);`);
    t('dialog closes after the celebration', !(await js(`return !!document.querySelector('.modal')`)));
    t('confetti canvas cleaned up', !(await js(`await T.sleep(1500); return !!document.querySelector('canvas.confetti')`)));

    // add links
    await js(`await T.click('+ Add link'); const el = document.querySelector('input.link-add'); await T.type(el, 'not a url'); await T.key('Enter', {}, el);`);
    t('a bad extra link is refused', ship().urls.length === 1);
    await js(`const el = document.querySelector('input.link-add'); await T.type(el, 'https://x.com/me/status/1'); await T.key('Enter', {}, el); await T.sleep(200);`);
    t('a second link is added', ship().urls.length === 2, JSON.stringify(ship().urls));
    t('chips show both links', (await js(`return document.querySelectorAll('.link-chip a').length`)) === 2);
    await shot('06-burst-links');

    // X on links
    await js(`document.querySelectorAll('.link-chip button')[1].click(); await T.sleep(250);`);
    t('X removes a link', ship().urls.length === 1 && S().burst.shipped);
    await js(`document.querySelector('.link-chip button').click(); await T.sleep(250);`);
    t('X on the last link un-ships it', ship().urls.length === 0 && !S().burst.shipped && ship().status === 'active', JSON.stringify([ship().status, S().burst.shipped]));
    t('Ship it is back', !!(await js(`return !!T.btn('Ship it')`)));

    // ship again and finish & log
    await js(`await T.key('s', { metaKey: true }); await T.type('.modal input', 'github.com/me/thing-v2'); await T.click('It is live'); await T.sleep(1500);`);
    t('re-ship works (bare domain normalised)', S().burst.shipped && ship().urls[0]?.startsWith('https://'), JSON.stringify(ship().urls));
    await js(`await T.key('s', { metaKey: true });`);
    t('Cmd+S on a shipped burst opens Finish', (await js(`return T.text('.modal h3')`)) === 'Finish and log it.');
    await js(`await T.type(document.querySelectorAll('.modal input')[0], 'It went live in 40 minutes'); await T.type(document.querySelectorAll('.modal input')[1], 'Add dark mode'); await T.click('Log the ship'); await T.sleep(300);`);
    t('Finish & log ends the burst', S().burst === null);
    t('history records a ship', S().history[0]?.outcome === 'shipped');
    t('win and v2 saved on the ship', ship().win === 'It went live in 40 minutes' && ship().v2 === 'Add dark mode', JSON.stringify([ship().win, ship().v2]));
    t('ship stays shipped', ship().status === 'shipped');

    // ---------------- Ship log ----------------
    await js(`await T.tab('Ship log');`);
    const logText = await js(`return document.querySelector('.main').innerText`);
    t('ship log lists the ship and its win', logText.includes(ship().title) && logText.includes('It went live in 40 minutes'));
    await shot('07-shiplog');

    // icon buttons say what they are on hover
    const rect = await js(`const r = document.querySelector('.log-entry button[aria-label="Share"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(rect.x), y: Math.round(rect.y) });
    await new Promise((r) => setTimeout(r, 600));
    const tip = await js(`const b = document.querySelector('.log-entry button[aria-label="Share"]'); const a = getComputedStyle(b, '::after'); return { text: a.content, opacity: a.opacity, labels: [...document.querySelectorAll('.log-entry .icon-action')].map((x) => x.getAttribute('aria-label')) };`);
    t('hovering an icon shows its label', tip.text === '"Share"' && tip.opacity === '1', JSON.stringify(tip));
    t('log rows have Share, Edit and Delete icons', ['Share', 'Edit', 'Delete'].every((l) => tip.labels.includes(l)));
    await shot('07a-icon-hover');
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 700 });

    // share card
    const share = await js(`
      const row = [...document.querySelectorAll('.log-entry')][0];
      row.querySelector('button[aria-label="Share"]').click();
      for (let i = 0; i < 30 && !document.querySelector('.share-canvas.ready'); i++) await T.sleep(100);
      const c = document.querySelector('.share-canvas');
      const bad = await window.burst.share.copyImage('data:text/html,<b>nope</b>');
      return { ready: !!document.querySelector('.share-canvas.ready'), w: c?.width, h: c?.height,
        buttons: [...document.querySelectorAll('.modal.share button')].map((b) => b.textContent),
        png: c ? c.toDataURL('image/png') : '', bad };
    `);
    t('Share opens a 1200x675 card', share.ready && share.w === 1200 && share.h === 675, JSON.stringify([share.w, share.h]));
    t('with copy, save and post buttons', ['Copy image', 'Save PNG…', 'Post on X', 'Post on LinkedIn'].every((b) => share.buttons.includes(b)));
    t('a non-PNG is refused for the clipboard', share.bad === false);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, '07c-share-card.png'), Buffer.from(share.png.split(',')[1], 'base64'));
    await shot('07c-share-dialog');
    await js(`await T.key('Escape');`);
    t('Esc closes the share dialog', !(await js(`return !!document.querySelector('.modal.share')`)));

    // delete from the log: back to the Inbox, undo, delete permanently, undo
    const logged = structuredClone(ship());
    const histBefore = S().history.length;
    const openRemove = `const row = [...document.querySelectorAll('.log-entry')].find((x) => x.querySelector('.title')?.textContent === ${JSON.stringify(logged.title)}); row.querySelector('button[aria-label="Delete"]').click(); await T.sleep(200);`;
    await js(openRemove);
    t('Delete opens the choice dialog', (await js(`return T.text('.modal h3')`)).includes(logged.title));
    await shot('07b-shiplog-delete');
    await js(`await T.click('Back to Inbox'); await T.sleep(200);`);
    const backIdea = logged.ideaId
      ? S().ideas.find((i) => i.id === logged.ideaId)
      : S().ideas.find((i) => i.text === logged.title);
    t('Back to Inbox removes the ship and returns its idea', !S().ships.some((s) => s.id === logged.id) && backIdea?.status === 'inbox', JSON.stringify(backIdea && [backIdea.text, backIdea.status]));
    t('its burst history is kept', S().history.length === histBefore);
    await js(`await T.click('Undo'); await T.sleep(200);`);
    const undoneIdea = logged.ideaId ? S().ideas.find((i) => i.id === logged.ideaId) : S().ideas.find((i) => i.text === logged.title);
    t('Undo restores the ship and the idea', ship()?.status === 'shipped' && (logged.ideaId ? undoneIdea?.status === 'shrunk' : !undoneIdea), JSON.stringify(undoneIdea && undoneIdea.status));
    await js(openRemove + ` await T.click('Delete permanently'); await T.sleep(200);`);
    t('Delete permanently removes it', !S().ships.some((s) => s.id === logged.id) && S().history.length === histBefore);
    await js(`await T.click('Undo'); await T.sleep(200);`);
    t('and Undo brings it back too', ship()?.status === 'shipped' && ship()?.win === logged.win);

    // ---------------- Park path ----------------
    await js(`await T.tab('Spin'); await T.key(' '); for (let i = 0; i < 40 && !document.querySelector('.reel.landed'); i++) await T.sleep(200); await T.key('Enter', { metaKey: true }); await T.sleep(300);`);
    t('second burst started', !!S().burst);
    const parkId = S().burst.shipId;
    await js(`await T.click('End burst'); await T.click('Park it');`);
    t('ending without a reason is refused', !!S().burst);
    await js(`await T.type('.modal textarea', 'Ran out of time'); await T.click('Park it'); await T.sleep(300);`);
    const parked = S().ships.find((s) => s.id === parkId);
    t('ending unshipped parks with the reason', S().burst === null && parked.status === 'parked' && parked.blockedReason === 'Ran out of time', JSON.stringify([parked.status, parked.blockedReason]));
    t('history records the park', S().history[0]?.outcome === 'parked');

    // ---------------- Delete mid-burst ----------------
    await js(`await T.tab('Spin'); await T.key(' '); for (let i = 0; i < 40 && !document.querySelector('.reel.landed'); i++) await T.sleep(200); await T.key('Enter', { metaKey: true }); await T.sleep(300);`);
    const delId = S().burst?.shipId;
    const delTitle = S().ships.find((s) => s.id === delId)?.title;
    await js(`await T.tab('Shrink'); const item = [...document.querySelectorAll('.item')].find((x) => x.querySelector('.title')?.textContent === ${JSON.stringify(delTitle)}); item.querySelector('button[aria-label="Delete"]').click(); await T.sleep(300);`);
    t('deleting the burst ship ends the burst', S().burst === null && !S().ships.some((s) => s.id === delId));
    t('and still logs it', S().history[0]?.shipId === delId);
    await js(`await T.tab('Burst');`);
    t('Burst tab shows the empty state', (await js(`return document.querySelector('.main').innerText`)).includes('No burst running'));

    // ---------------- One ship left: no spin ----------------
    const actives = S().ships.filter((s) => s.status === 'active');
    for (const s of actives.slice(1)) await js(`await window.burst.ships.remove(${JSON.stringify(s.id)});`);
    const lone = actives[0];
    await js(`await T.tab('Spin');`);
    t('one active ship skips the reel', (await js(`return T.text('.only-line')`)).startsWith('Only this one left') && (await js(`return T.text('.reel-row.win')`)) === lone.title);
    t('and there is no Spin button', !(await js(`return !!T.btn('Spin', document.querySelector('.spin-stage'))`)));
    await shot('08-only-one');
    await js(`await T.key('Enter', { metaKey: true }); await T.sleep(300);`);
    t('Cmd+Enter starts the burst on it', S().burst?.shipId === lone.id);
    await js(`await window.burst.burst.end('parked', 'test cleanup');`);

    // ---------------- Liquid-glass tab pill ----------------
    const glide = await js(`
      const pillRect = () => document.querySelector('.tab-glass').getBoundingClientRect();
      const tabRect = (name) => [...document.querySelectorAll('.tabs .tab')].find((b) => b.textContent.replace(/[0-9●]/g, '').trim() === name).getBoundingClientRect();
      await T.tab('Inbox'); await T.sleep(700);
      const start = pillRect();
      T.tab('Ship log');
      const widths = [];
      for (let i = 0; i < 12; i++) { await new Promise((r) => requestAnimationFrame(r)); widths.push(Math.round(pillRect().width)); }
      await T.sleep(700);
      const end = pillRect(); const target = tabRect('Ship log');
      return { startW: Math.round(start.width), maxW: Math.max(...widths), endOk: Math.abs(end.left - target.left) < 1.5 && Math.abs(end.right - target.right) < 1.5 };
    `);
    t('the glass pill lands on the clicked tab', glide.endOk, JSON.stringify(glide));
    t('and stretches while it travels', glide.maxW > glide.startW + 20, JSON.stringify(glide));
    await shot('09-tabs');

    // ---------------- Settings + shortcuts ----------------
    await js(`await T.key('?');`);
    t('? opens the shortcuts sheet', (await js(`return T.text('.modal.sheet h3')`)) === 'Keyboard shortcuts');
    await js(`await T.key('Escape');`);
    t('Esc closes it', !(await js(`return !!document.querySelector('.modal')`)));
    await js(`document.querySelector('button[title^="Settings"]').click(); await T.sleep(200); await T.click('Light'); await T.sleep(200);`);
    t('theme choice saved', S().settings.theme === 'light', S().settings.theme);
    await shot('10-light');

    // ---------------- Sun/moon toggle ----------------
    const lightBtn = await js(`const b = document.querySelector('.theme-btn'); return b ? { cls: b.className, label: b.getAttribute('aria-label') } : null`);
    t('title bar has the sun/moon toggle', !!lightBtn && lightBtn.cls.includes('is-light'), JSON.stringify(lightBtn));
    t('in light it offers dark (moon)', lightBtn && lightBtn.label === 'Dark mode');
    await js(`document.querySelector('.theme-btn').click(); await T.sleep(600);`);
    t('click switches to dark', S().settings.theme === 'dark' && nativeTheme.shouldUseDarkColors, S().settings.theme);
    const darkBtn = await js(`const b = document.querySelector('.theme-btn'); return { cls: b.className, bg: getComputedStyle(document.body).backgroundColor }`);
    t('and the icon turns into the sun', darkBtn.cls.includes('is-dark'), JSON.stringify(darkBtn));
    await shot('11-dark-toggle');
    await js(`document.querySelector('.theme-btn').click(); await T.sleep(600);`);
    t('click again goes back to light', S().settings.theme === 'light' && !nativeTheme.shouldUseDarkColors);
    await js(`await T.click('Dark'); await T.sleep(200);`);

    // ---------------- Persistence ----------------
    store.saveNow();
    const reread = new Store();
    t('everything is on disk', JSON.stringify(reread.get()) === JSON.stringify(S()));
    t('summary', true, `ideas=${S().ideas.length} ships=${S().ships.length} history=${S().history.length}`);
  } catch (err) {
    t('script ran to the end', false, String(err && err.stack || err));
    await shot('zz-failure').catch(() => {});
  }

  t('no renderer errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(fail ? 1 : 0);
});
