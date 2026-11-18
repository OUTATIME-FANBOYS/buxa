/**
 * Draws the Buxa app icons as PNG files from the same geometry as apps/web/app/icon.svg (32-unit grid).
 * Run once after changing the mark: `node scripts/generate-pwa-icons.mjs`. No dependencies: the rasteriser and PNG encoder are below.
 *
 * Outputs in apps/web/public/icons:
 *   icon-192.png, icon-512.png   the manifest icons (rounded square, transparent corners)
 *   apple-touch-icon.png         180px, full square (iOS fills transparent corners black, so no rounding)
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEAL = [0x0f, 0x71, 0x73];
const WHITE = [0xff, 0xff, 0xff];
const SAMPLES = 4; // per axis, so 16 samples per pixel for anti-aliased edges

/** Coverage (0..1) of a rounded rectangle at point (x, y), in 32-unit grid space. */
function inRoundRect(x, y, [rx0, ry0, w, h, r]) {
  if (x < rx0 || y < ry0 || x > rx0 + w || y > ry0 + h) {
    return false;
  }
  const cx = Math.min(Math.max(x, rx0 + r), rx0 + w - r);
  const cy = Math.min(Math.max(y, ry0 + r), ry0 + h - r);

  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** The mark: the teal tile (or square) and three white bars, as in icon.svg. */
const BARS = [
  [8, 8, 4, 12, 2],
  [14, 8, 4, 16, 2],
  [20, 8, 4, 8, 2],
];

function render(size, { rounded }) {
  const scale = 32 / size;
  const data = Buffer.alloc(size * size * 4);
  const tile = rounded ? [0, 0, 32, 32, 8] : [0, 0, 32, 32, 0];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          if (!inRoundRect(x, y, tile)) {
            continue;
          }
          const bar = BARS.some(bar => inRoundRect(x, y, bar));
          const colour = bar ? WHITE : TEAL;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }
      const n = SAMPLES * SAMPLES;
      const i = (py * size + px) * 4;
      if (a > 0) {
        // Colour is averaged over covered samples only, so edges do not darken.
        const covered = a / 255;
        data[i] = Math.round(r / covered);
        data[i + 1] = Math.round(g / covered);
        data[i + 2] = Math.round(b / covered);
      }
      data[i + 3] = Math.round(a / n);
    }
  }

  return data;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), body])), 0);

  return Buffer.concat([head, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = fileURLToPath(new URL('../apps/web/public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const outputs = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['apple-touch-icon.png', 180, { rounded: false }],
];
for (const [name, size, options] of outputs) {
  writeFileSync(`${outDir}${name}`, encodePng(size, render(size, options)));
  console.log(`wrote public/icons/${name} (${size}px)`);
}
