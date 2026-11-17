import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { qrPath, qrSvg } from '../svg';

function decode(payload: string): string | null {
  const { size, d } = qrPath(payload);
  const scale = 8, w = size * scale;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (const m of d.matchAll(/M(\d+) (\d+)h/g)) {
    const mx = Number(m[1]), my = Number(m[2]);
    for (let y = my * scale; y < (my + 1) * scale; y++) for (let x = mx * scale; x < (mx + 1) * scale; x++) {
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
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
