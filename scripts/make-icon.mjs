// Generates build/icon.png (1024x1024) and build/icon.icns with no image dependencies.
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 1024;
const OUT_DIR = path.resolve('build');
const PNG = path.join(OUT_DIR, 'icon.png');
const ICONSET = path.join(OUT_DIR, 'icon.iconset');
const ICNS = path.join(OUT_DIR, 'icon.icns');

const BG = [0x14, 0x19, 0x24];
const BG_EDGE = [0x1f, 0x27, 0x38];
const BOLT = [0xff, 0xb4, 0x3d];

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
function inSquare(x, y, inset, radius) {
  const lo = inset;
  const hi = 1 - inset;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const cx = Math.min(Math.max(x, lo + radius), hi - radius);
  const cy = Math.min(Math.max(y, lo + radius), hi - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function render() {
  const SS = 3; // supersampling for smooth edges
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let p = 0;
  for (let py = 0; py < SIZE; py++) {
    raw[p++] = 0; // filter: none
    for (let px = 0; px < SIZE; px++) {
      let bgHits = 0;
      let boltHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / SIZE;
          const y = (py + (sy + 0.5) / SS) / SIZE;
          if (inSquare(x, y, 0.055, 0.225)) {
            bgHits++;
            if (inPoly(x, y, BOLT_PTS)) boltHits++;
          }
        }
      }
      const total = SS * SS;
      const alpha = Math.round((bgHits / total) * 255);
      const base = mix(BG, BG_EDGE, py / SIZE);
      const boltT = bgHits ? boltHits / bgHits : 0;
      const [r, g, b] = mix(base, BOLT, boltT);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = alpha;
    }
  }
  return raw;
}

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

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(PNG, pngOf(render()));
console.log(`icon: wrote ${PNG}`);

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
