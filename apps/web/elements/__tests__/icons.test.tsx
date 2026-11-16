import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from '../icons';

describe('icon glyph set', () => {
  it('has a glyph for every name the app asks for', () => {
    const names = Object.keys(ICON_PATHS);
    expect(names.length).toBeGreaterThan(10);
    for (const name of ['user', 'agent', 'check', 'message', 'edit', 'arrowRight', 'plus']) expect(names).toContain(name);
  });
});
