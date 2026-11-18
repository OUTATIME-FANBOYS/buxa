import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const auth = readFileSync(new URL('./layout/auth.css', import.meta.url), 'utf8');

/** The body of the first rule whose selector is exactly `selector`, up to its closing brace at the start of a line. */
const block = (selector: string): string => {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`no block ${selector}`);
  }
  const end = tokens.indexOf('\n}', start);

  return tokens.slice(start, end);
};

const BACKGROUND_TOKENS = ['--hero-bg', '--hero-fg', '--hero-fg-2', '--auth-glow', '--auth-stars', '--auth-tint'];

describe('sign-in background tokens', () => {
  it('the light theme (:root) defines the hero background, its text, the glows and the stars', () => {
    const root = block(':root');
    for (const token of BACKGROUND_TOKENS) {
      expect(root, token).toContain(`${token}:`);
    }
  });

  it('the dark theme ([data-theme=dark]) defines the same tokens, so the page switches with the theme', () => {
    const dark = block("[data-theme='dark']");
    for (const token of BACKGROUND_TOKENS) {
      expect(dark, token).toContain(`${token}:`);
    }
  });

  it('the dark hero is a deep grey-navy, not the violet it was', () => {
    expect(block("[data-theme='dark']")).toContain('--hero-bg: #1b1f29;');
    expect(block(':root')).toContain('--hero-bg: #eef1f4;');
  });

  it('the layout reads the tokens in CSS, not inline', () => {
    expect(auth).toContain('var(--auth-glow), var(--auth-stars), var(--hero-bg)');
    expect(auth).not.toContain('background-image');
    expect(auth).not.toContain('--auth-dots');
    expect(auth).toContain('background-color: var(--auth-tint)');
  });

  it('the light theme tints the form side teal and draws darker teal stars, the dark theme tints it coral-orange', () => {
    expect(block(':root')).toContain('rgba(11, 90, 94, 0.18)');
    expect(block(':root')).toContain('--auth-tint: #d6eeeb;');
    expect(block(':root')).toContain('rgba(10, 79, 81, 0.6)');
    expect(block("[data-theme='dark']")).toContain('--auth-tint: #55333a;');
  });
});
