// Renders build/icon-src/{dark,light}.svg to 1024px PNGs with Electron, which
// draws their blur and edge filters faithfully. Run with: npm run icon:render
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'build', 'icon-src');

// Closing the first window must not end the app before the second renders.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  for (const name of ['dark', 'light']) {
    const win = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: { offscreen: true, sandbox: true },
    });
    win.webContents.setFrameRate(1);
    await win.loadFile(path.join(SRC, `${name}.svg`));
    await new Promise((r) => setTimeout(r, 500));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
    const out = img.getSize().width === 1024 ? img : img.resize({ width: 1024, height: 1024, quality: 'best' });
    fs.writeFileSync(path.join(SRC, `${name}.png`), out.toPNG());
    console.log(`icon: rendered ${name}.png`);
    win.destroy();
  }
  app.quit();
});
