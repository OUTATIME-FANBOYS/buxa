import { describe, expect, it } from 'vitest';
import { createScanDeduper } from './dedupe';
import { normalizeScan } from './scan-input';

describe('normalizeScan', () => {
  it('trims and drops empties', () => {
    expect(normalizeScan('  bx1.abc \n')).toBe('bx1.abc');
    expect(normalizeScan('   ')).toBeNull();
    expect(normalizeScan('')).toBeNull();
  });
});

describe('createScanDeduper', () => {
  it('ignores the same code within the window, accepts it after', () => {
    let t = 0;
    const d = createScanDeduper(1500, () => t);
    expect(d.accept('a')).toBe(true);
    t = 1000; expect(d.accept('a')).toBe(false);
    t = 1600; expect(d.accept('a')).toBe(true);
  });
  it('always accepts a different code', () => {
    const d = createScanDeduper(1500, () => 0);
    expect(d.accept('a')).toBe(true);
    expect(d.accept('b')).toBe(true);
    expect(d.accept('a')).toBe(true);
  });
  it('with an infinite window suppresses repeats until another code appears', () => {
    let t = 0;
    const d = createScanDeduper(Infinity, () => t);
    expect(d.accept('a')).toBe(true);
    t = 1e9; expect(d.accept('a')).toBe(false);
    expect(d.accept('b')).toBe(true);
    d.reset();
    expect(d.accept('b')).toBe(true);
  });
});
