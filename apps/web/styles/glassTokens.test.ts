import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, 'tokens.css'), 'utf8');
const buttons = readFileSync(join(here, 'components', 'button.css'), 'utf8');

// The light block is :root; the dark block is [data-theme='dark'], which comes after it.
const darkStart = tokens.indexOf("[data-theme='dark'] {");
const light = tokens.slice(0, darkStart);
const dark = tokens.slice(darkStart);

describe('the liquid-glass button tokens', () => {
  it('are lighter and transparent in light mode, with darker ink and a fainter top highlight', () => {
    expect(light).toMatch(/--glass-fill:\s*color-mix\(in srgb, var\(--hue-grey\) 8%, transparent\)/);
    expect(light).toMatch(/--glass-ink:\s*#111827/);
    expect(light).toMatch(/--glass-highlight:\s*rgba\(255, 255, 255, 0\.35\)/);
  });

  it('keep the dark mode values the glass has always had', () => {
    expect(dark).toMatch(/--glass-fill:\s*var\(--hue-grey-soft\)/);
    expect(dark).toMatch(/--glass-ink:\s*var\(--hue-grey-ink\)/);
    expect(dark).toMatch(/--glass-ink-danger:\s*var\(--hue-red-ink\)/);
    expect(dark).toMatch(/--glass-highlight:\s*rgba\(255, 255, 255, 0\.22\)/);
  });

  it('the glass buttons read these tokens, not the hue tokens', () => {
    expect(buttons).toMatch(/\.button--glass \{\s*--button-bg: var\(--glass-fill\);/);
    expect(buttons).toMatch(/\.button--glass-danger \{\s*--button-bg: var\(--glass-fill-danger\);/);
    expect(buttons).toMatch(/--button-fg: var\(--glass-ink-danger\);/);
  });
});
