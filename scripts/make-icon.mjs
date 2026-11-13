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

// The app's own palette: a dark glass tile, sage bolt.
const BG_TOP = [0x3e, 0x42, 0x45];
const BG_BOTTOM = [0x25, 0x28, 0x2a];
const BOLT_TOP = [0xae, 0xe2, 0xc3];
const BOLT_BOTTOM = [0x8a, 0xcf, 0xa5];
const GLOW = [0x8e, 0xd1, 0xa8];
const RIM = [0xff, 0xff, 0xff];
const SHADOW = [0x0b, 0x12, 0x0f];

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

// The app icon's bolt sits a little smaller than the tray bolt, leaving room
// for its shadow.
// Leaned a few degrees further than the tray bolt, for a sense of motion.
const SLANT = (4 * Math.PI) / 180;
const ICON_BOLT = BOLT_PTS.map(([x, y]) => {
  const dx = (x - 0.5) * 0.76;
  const dy = (y - 0.5) * 0.76;
  return [
    0.49 + dx * Math.cos(SLANT) - dy * Math.sin(SLANT),
    0.47 + dx * Math.sin(SLANT) + dy * Math.cos(SLANT),
  ];
});
// The bolt's extruded shadow falls down and to the right.
const EXTRUDE = [0.03, 0.038];

const INSET = 0.055;
const RADIUS = 0.225;
const RIM_W = 0.016;

/** Three box blurs approximate a gaussian. Operates on a SIZE x SIZE field. */
function blur(src, r) {
  let a = src;
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      for (let line = 0; line < SIZE; line++) {
        let sum = 0;
        const at = (i) => (horizontal ? line * SIZE + i : i * SIZE + line);
        for (let i = -r; i <= r; i++) sum += a[at(Math.min(Math.max(i, 0), SIZE - 1))];
        for (let i = 0; i < SIZE; i++) {
          b[at(i)] = sum / (2 * r + 1);
          sum += a[at(Math.min(i + r + 1, SIZE - 1))] - a[at(Math.max(i - r, 0))];
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

function render() {
  const SS = 3; // supersampling for smooth edges
  const total = SS * SS;
  const tile = new Float32Array(SIZE * SIZE);
  const rim = new Float32Array(SIZE * SIZE);
  const bolt = new Float32Array(SIZE * SIZE);
  const drop = new Float32Array(SIZE * SIZE);
  const inner = new Float32Array(SIZE * SIZE);
  const STEPS = 18;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let t = 0;
      let rm = 0;
      let bl = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / SIZE;
          const y = (py + (sy + 0.5) / SS) / SIZE;
          if (!inSquare(x, y, INSET, RADIUS)) continue;
          t++;
          if (!inSquare(x, y, INSET + RIM_W, RADIUS - RIM_W)) rm++;
          if (inPoly(x, y, ICON_BOLT)) bl++;
        }
      }
      const i = py * SIZE + px;
      tile[i] = t / total;
      rim[i] = rm / total;
      bolt[i] = bl / total;
      {
        const ix = (px + 0.5) / SIZE;
        const iy = (py + 0.5) / SIZE;
        const a = INSET + RIM_W + 0.006;
        inner[i] =
          inSquare(ix, iy, a, RADIUS - (a - INSET)) && !inSquare(ix, iy, a + 0.003, RADIUS - (a + 0.003 - INSET))
            ? 1
            : 0;
      }
      // Extrusion: the bolt swept along the shadow direction.
      const cx = (px + 0.5) / SIZE;
      const cy = (py + 0.5) / SIZE;
      for (let k = 1; k <= STEPS; k++) {
        const f = k / STEPS;
        if (inPoly(cx - EXTRUDE[0] * f, cy - EXTRUDE[1] * f, ICON_BOLT)) {
          drop[i] = 1;
          break;
        }
      }
    }
  }

  const shadow = blur(drop, 2);
  const soft = blur(drop, Math.round(SIZE * 0.02));
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let p = 0;
  for (let py = 0; py < SIZE; py++) {
    raw[p++] = 0; // filter: none
    const v = py / SIZE;
    for (let px = 0; px < SIZE; px++) {
      const i = py * SIZE + px;
      const u = px / SIZE;
      // Layers are composited "over" each other, so the glass body can stay
      // partly see-through while the rim, shadow and bolt are solid.
      const out = [0, 0, 0, 0]; // premultiplied r, g, b, a
      const over = (rgb, a) => {
        if (a <= 0) return;
        const k = 1 - a;
        out[0] = rgb[0] * a + out[0] * k;
        out[1] = rgb[1] * a + out[1] * k;
        out[2] = rgb[2] * a + out[2] * k;
        out[3] = a + out[3] * k;
      };
      // Tinted glass body: clearer at the top, denser toward the bottom.
      over(mix(BG_TOP, BG_BOTTOM, v), 0.62 + v * 0.16);
      // A faint sage glow behind the bolt.
      const d = Math.hypot(u - 0.5, (v - 0.47) * 1.1);
      over(GLOW, Math.max(0, 1 - d / 0.42) ** 2 * 0.07);
      // Sheen across the upper half, like light on glass.
      const sheen = Math.max(0, 1 - Math.hypot((u - 0.42) / 0.6, (v - 0.1) / 0.3));
      over(RIM, sheen ** 1.6 * 0.12);
      // Inner reflection line just inside the rim.
      over(RIM, inner[i] * 0.16);
      // The bolt's extruded shadow, with a soft falloff around it.
      over(SHADOW, Math.min(1, soft[i] * 0.3));
      over(SHADOW, Math.min(1, shadow[i] * 0.94));
      // Thick glossy rim: bright at the top left, dimmer round to the bottom right.
      const lit = Math.max(0, Math.min(1, 1.1 - (u * 0.55 + v * 0.75)));
      over(mix([0x4a, 0x55, 0x57], RIM, lit * 0.85), rim[i] * (0.75 + lit * 0.25));
      if (tile[i] > 0) over(mix(BOLT_TOP, BOLT_BOTTOM, v), bolt[i] / tile[i]);
      const a = out[3] * tile[i];
      const un = out[3] > 0 ? 1 / out[3] : 0;
      raw[p++] = Math.round(out[0] * un);
      raw[p++] = Math.round(out[1] * un);
      raw[p++] = Math.round(out[2] * un);
      raw[p++] = Math.round(a * 255);
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

// Icon Composer bundle for macOS 26+: the system draws real Liquid Glass from
// it - the squircle, rim, highlights and the bolt's shadow - and swaps the
// background for light and dark mode. The .icns above stays as the fallback.
const ICON_BUNDLE = path.join(OUT_DIR, 'icon.icon');
fs.rmSync(ICON_BUNDLE, { recursive: true, force: true });
fs.mkdirSync(path.join(ICON_BUNDLE, 'Assets'), { recursive: true });
// The system frames the glass with its own margin, so the bolt is drawn larger.
const pts = ICON_BOLT.map(([x, y]) => [0.5 + (x - 0.5) * 1.22, 0.5 + (y - 0.48) * 1.22])
  .map(([x, y]) => `${(x * 1024).toFixed(1)},${(y * 1024).toFixed(1)}`)
  .join(' ');
fs.writeFileSync(
  path.join(ICON_BUNDLE, 'Assets', 'bolt.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<polygon points="${pts}" fill="#8ED1A8"/></svg>\n`,
);
const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(5));
  return `srgb:${c.join(',')},1.00000`;
};
fs.writeFileSync(
  path.join(ICON_BUNDLE, 'icon.json'),
  JSON.stringify(
    {
      // Flat fallback (.icns, older macOS): the dark look.
      fill: { 'automatic-gradient': srgb('#141518') },
      'fill-specializations': [
        // Light mode: a sage glass tile with a dark bolt.
        { value: { 'automatic-gradient': srgb('#8ed1a8') } },
        // Dark mode: a near-black tile with a sage bolt.
        { appearance: 'dark', value: { 'automatic-gradient': srgb('#141518') } },
      ],
      groups: [
        {
          layers: [
            {
              'image-name': 'bolt.svg',
              name: 'bolt',
              glass: true,
              fill: { solid: srgb('#8ed1a8') },
              'fill-specializations': [
                { value: { solid: srgb('#16191b') } },
                { appearance: 'dark', value: { solid: srgb('#8ed1a8') } },
              ],
            },
          ],
          // Liquid Glass: frosted, lit from above, with a soft shadow beneath.
          lighting: 'individual',
          specular: true,
          'blur-material': 0.5,
          translucency: { enabled: true, value: 0.45 },
          shadow: { kind: 'layer-color', opacity: 0.55 },
        },
      ],
      'supported-platforms': { squares: ['macOS'] },
    },
    null,
    2,
  ) + '\n',
);
console.log(`icon: wrote ${ICON_BUNDLE}`);

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
