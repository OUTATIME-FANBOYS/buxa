import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_THEME_KEY, THEME_KEY } from './theme';

describe('theme storage keys', () => {
  // theme-init.js is a static file that runs before React; it cannot import the constants, so this keeps it in step.
  const script = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');
  it('the early script reads exactly the keys the app writes', () => {
    expect(script).toContain(`'${THEME_KEY}'`);
    expect(script).toContain(`'${LEGACY_THEME_KEY}'`);
  });
  it('the keys are distinct', () => expect(THEME_KEY).not.toBe(LEGACY_THEME_KEY));
});
