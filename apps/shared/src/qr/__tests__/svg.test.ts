import { describe, expect, it } from 'vitest';
import { qrPath, qrSvg } from '../svg';

describe('qr svg', () => {
  it('qrPath is deterministic, grows with the payload, and includes the 4-module quiet zone', () => {
    const a = qrPath('BUXA-1');
    expect(qrPath('BUXA-1')).toEqual(a);
    expect(a.size).toBeGreaterThan(8);
    expect(a.size % 1).toBe(0);
    expect(a.d.startsWith('M')).toBe(true);
    expect(qrPath('a much longer payload that needs a bigger grid than the short one').size).toBeGreaterThan(a.size);
  });
  it('qrSvg is a standalone svg with the same path, no scripts or external references', () => {
    const { size, d } = qrPath('BUXA-1');
    const svg = qrSvg('BUXA-1');
    expect(svg).toContain(`viewBox="0 0 ${size} ${size}"`);
    expect(svg).toContain(`d="${d}"`);
    expect(svg).not.toMatch(/<script|href=|xlink:/);
  });
});
