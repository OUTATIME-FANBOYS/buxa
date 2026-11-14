import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { credentialPayload, isCredentialToken } from '@buxa/domain';
import { generateCredentialToken, hashCredentialToken, qrPath, qrSvg } from './index';

describe('credential tokens', () => {
  it('is 22 base64url characters and passes the domain check', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateCredentialToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(isCredentialToken(t)).toBe(true);
    }
  });
  it('does not repeat over 1000 tokens', () => {
    expect(new Set(Array.from({ length: 1000 }, generateCredentialToken)).size).toBe(1000);
  });
  it('hashes to 32 bytes, deterministically, without containing the token', () => {
    const t = generateCredentialToken();
    const h = hashCredentialToken(t);
    expect(h).toBeInstanceOf(Buffer);
    expect(h.length).toBe(32);
    expect(h.equals(hashCredentialToken(t))).toBe(true);
    expect(h.includes(Buffer.from(t))).toBe(false);
    expect(h.toString('base64url')).not.toContain(t);
  });
  it('gives different tokens different hashes', () => {
    expect(hashCredentialToken(generateCredentialToken()).equals(hashCredentialToken(generateCredentialToken()))).toBe(false);
  });
});

/** Rasterise the path (8 px per module) into the RGBA buffer a decoder expects. */
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
    const payload = credentialPayload(generateCredentialToken());
    expect(decode(payload)).toBe(payload);
  });
  it('is a self-contained SVG', () => {
    const svg = qrSvg('bx1.abc');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<script|href=|<image|on\w+=/i);
  });
});
