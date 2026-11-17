import { describe, expect, it } from 'vitest';
import { ICONS } from '@/components/elements/export';

describe('icon set', () => {
  it('has a lucide glyph for every name the app asks for', () => {
    const names = Object.keys(ICONS);
    expect(names.length).toBeGreaterThan(10);
    for (const name of ['user', 'agent', 'check', 'message', 'edit', 'arrowRight', 'plus', 'help', 'settings']) {
      expect(names).toContain(name);
    }
  });
});
