// Builds the app icon (build/icon.png, build/icon.icns, build/icon.icon) from the
// rendered artwork, and draws the menu bar template images.
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 1024;
const OUT_DIR = path.resolve('build');
const PNG = path.join(OUT_DIR, 'icon.png');
const ICONSET = path.join(OUT_DIR, 'icon.iconset');
const ICNS = path.join(OUT_DIR, 'icon.icns');

// Lightning bolt, in 0..1 icon space.
const BOLT_PTS = [
  [0.585, 0.075],
  [0.255, 0.565],
  [0.455, 0.565],
  [0.38, 0.93],
  [0.745, 0.435],
  [0.545, 0.435],
];

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Rounded-square mask, Apple-ish squircle-lite. */

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function pngOf(raw, size = SIZE) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}


// The app icon artwork lives in build/icon-src as dark.svg and light.svg,
// rendered to PNG by scripts/render-icon.cjs (npm run icon:render).
const SRC = path.join(OUT_DIR, 'icon-src');
fs.mkdirSync(OUT_DIR, { recursive: true });
// The flat fallback (.icns, the installer, older macOS) uses the dark look.
fs.copyFileSync(path.join(SRC, 'dark.png'), PNG);
console.log(`icon: wrote ${PNG}`);

// Icon Composer bundle for macOS 26+. macOS shapes the icon itself, so it
// gets the tile alone, edge to edge, and switches artwork for light and dark.
if (process.platform === 'darwin') {
  const ICON_BUNDLE = path.join(OUT_DIR, 'icon.icon');
  fs.rmSync(ICON_BUNDLE, { recursive: true, force: true });
  fs.mkdirSync(path.join(ICON_BUNDLE, 'Assets'), { recursive: true });
  // The artwork's tile spans 112..912 of its 1024 canvas.
  for (const look of ['light', 'dark']) {
    const out = path.join(ICON_BUNDLE, 'Assets', `${look}.png`);
    execFileSync('sips', ['-c', '800', '800', '--cropOffset', '112', '112', path.join(SRC, `${look}.png`), '--out', out], { stdio: 'ignore' });
    execFileSync('sips', ['-z', '1024', '1024', out], { stdio: 'ignore' });
  }
  const srgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(5));
    return `srgb:${c.join(',')},1.00000`;
  };
  fs.writeFileSync(
    path.join(ICON_BUNDLE, 'icon.json'),
    JSON.stringify(
      {
        fill: { solid: srgb('#141b19') },
        'fill-specializations': [
          { value: { solid: srgb('#e4f3ec') } },
          { appearance: 'dark', value: { solid: srgb('#141b19') } },
        ],
        groups: [
          {
            layers: [
              // One layer per look; each is hidden in the other appearance.
              {
                'image-name': 'dark.png',
                name: 'dark',
                glass: false,
                'hidden-specializations': [{ value: true }, { appearance: 'dark', value: false }],
              },
              {
                'image-name': 'light.png',
                name: 'light',
                glass: false,
                'hidden-specializations': [{ value: false }, { appearance: 'dark', value: true }],
              },
            ],
            // The artwork already carries its own glass, rim and shadow.
            specular: false,
            shadow: { kind: 'none', opacity: 0 },
            translucency: { enabled: false, value: 0 },
          },
        ],
        'supported-platforms': { squares: ['macOS'] },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`icon: wrote ${ICON_BUNDLE}`);
}

// Menu bar template image: black bolt on transparency. macOS recolors template
// images automatically for light and dark menu bars.
function renderTray(size) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0;
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // Inset the bolt slightly so it sits well in the menu bar.
          const x = ((px + (sx + 0.5) / SS) / size - 0.5) / 1.18 + 0.5;
          const y = ((py + (sy + 0.5) / SS) / size - 0.5) / 1.12 + 0.5;
          if (inPoly(x, y, BOLT_PTS)) hits++;
        }
      }
      raw[p++] = 0;
      raw[p++] = 0;
      raw[p++] = 0;
      raw[p++] = Math.round((hits / (SS * SS)) * 255);
    }
  }
  return pngOf(raw, size);
}

const trayDir = path.resolve('assets', 'tray');
fs.mkdirSync(trayDir, { recursive: true });
fs.writeFileSync(path.join(trayDir, 'trayTemplate.png'), renderTray(16));
fs.writeFileSync(path.join(trayDir, 'trayTemplate@2x.png'), renderTray(32));
console.log('icon: wrote menu bar template images');

// .icns via macOS tooling.
if (process.platform === 'darwin') {
  fs.rmSync(ICONSET, { recursive: true, force: true });
  fs.mkdirSync(ICONSET, { recursive: true });
  const variants = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ];
  for (const [size, name] of variants) {
    execFileSync('sips', ['-z', String(size), String(size), PNG, '--out', path.join(ICONSET, name)], {
      stdio: 'ignore',
    });
  }
  execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', ICNS]);
  fs.rmSync(ICONSET, { recursive: true, force: true });
  console.log(`icon: wrote ${ICNS}`);
}
