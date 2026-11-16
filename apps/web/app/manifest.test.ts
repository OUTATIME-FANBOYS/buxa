import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import manifest from '@/app/manifest';

const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const rootToken = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)?.[1]?.toUpperCase();

describe('web app manifest', () => {
  const m = manifest();

  it('is named Buxa, standalone, and starts on the check-in screen', () => {
    expect(m.name).toBe('Buxa');
    expect(m.short_name).toBe('Buxa');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe(ROUTES.checkIn);
    expect(m.scope).toBe('/');
  });

  it('uses the brand colours, which are the CSS accent and background tokens', () => {
    expect(m.theme_color).toBe('#0F7173');
    expect(m.background_color).toBe('#E7ECEF');
    expect(m.theme_color).toBe(rootToken('accent'));
    expect(m.background_color).toBe(rootToken('bg'));
  });

  it('declares 192 and 512 PNG icons that exist in public/', () => {
    const icons = m.icons ?? [];
    for (const size of ['192x192', '512x512']) {
      const icon = icons.find(i => i.sizes === size);
      expect(icon, `icon ${size}`).toBeDefined();
      expect(icon?.type).toBe('image/png');
      expect(existsSync(new URL(`../public${icon?.src}`, import.meta.url))).toBe(true);
    }
  });

  it('takes its name and description from the brand constants', () => {
    expect(m.name).toBe(BRAND.name);
    expect(m.description).toBe(BRAND.description);
  });
});
