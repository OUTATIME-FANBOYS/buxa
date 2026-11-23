import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { QR_ERROR_LEVEL, QR_LOGO_SHARE, qrPath, qrSvg, type QrLogoBox } from '../svg';

const QUIET = 4;
const SCALE = 8;

/** Renders the modules of `d` as black on white pixels, then (optionally) covers the centre logo box the way the badge does. */
function render(d: string, size: number, logo?: QrLogoBox): { data: Uint8ClampedArray; w: number } {
  const w = size * SCALE;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  const paint = (x0: number, y0: number, x1: number, y1: number, value: number) => {
    for (let y = Math.round(y0 * SCALE); y < Math.round(y1 * SCALE); y++) {
      for (let x = Math.round(x0 * SCALE); x < Math.round(x1 * SCALE); x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = value;
      }
    }
  };
  for (const m of d.matchAll(/M(\d+) (\d+)h/g)) {
    const mx = Number(m[1]),
      my = Number(m[2]);
    paint(mx, my, mx + 1, my + 1, 0);
  }
  if (logo) {
    // The white square behind the mark, then the mark. The mark is worst-cased as a solid black block over most of the square, which
    // covers more of the code than the real mountain does.
    paint(logo.x, logo.y, logo.x + logo.side, logo.y + logo.side, 255);
    const inset = logo.side * 0.19;
    paint(logo.x + inset, logo.y + inset, logo.x + logo.side - inset, logo.y + logo.side - inset, 0);
  }

  return { data, w };
}

function decode(payload: string, withLogo = false): string | null {
  const { size, d, logo } = qrPath(payload);
  const { data, w } = render(d, size, withLogo ? logo : undefined);

  return jsQR(data, w, w)?.data ?? null;
}

describe('QR rendering', () => {
  it('decodes back to the payload', () => {
    const payload = 'bx1.abc';
    expect(decode(payload)).toBe(payload);
  });
  it('is a self-contained SVG', () => {
    const svg = qrSvg('bx1.abc');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<script|href=|<image|on\w+=/i);
  });
});

describe('QR with a centre logo', () => {
  const payload = 'bx1.AbCdEfGhIjKlMnOpQrStUv';

  it('is generated at error correction level H', () => {
    expect(QR_ERROR_LEVEL).toBe('H');
  });

  it('still decodes to the same payload with the logo covering the centre', () => {
    expect(decode(payload, true)).toBe(payload);
  });

  it('keeps the logo inside the central 20 percent of the code and at most 18 percent of its width', () => {
    const { size, logo } = qrPath(payload);
    const count = size - QUIET * 2;

    expect(logo.side / count).toBeLessThanOrEqual(QR_LOGO_SHARE + 1e-9);
    expect(logo.x).toBeGreaterThanOrEqual(size * 0.4);
    expect(logo.y).toBeGreaterThanOrEqual(size * 0.4);
    expect(logo.x + logo.side).toBeLessThanOrEqual(size * 0.6);
    expect(logo.y + logo.side).toBeLessThanOrEqual(size * 0.6);
  });
});
