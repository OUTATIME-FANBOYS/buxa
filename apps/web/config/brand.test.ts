import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND } from './brand';

describe('brand colours', () => {
  const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const light = tokens.slice(0, tokens.indexOf('[data-theme="dark"]'));
  it('the accent and background tokens in light mode are the brand colours', () => {
    expect(light).toMatch(new RegExp(`--accent:\\s*${BRAND.themeColour};`, 'i'));
    expect(light).toMatch(new RegExp(`--bg:\\s*${BRAND.background};`, 'i'));
  });
});
