import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The menu rows are Tailwind utilities in Menu.tsx (the ROW constant). Prettier breaks lines, so the text is flattened before matching.
const menu = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'components', 'Menu.tsx'),
  'utf8',
).replace(/\s+/g, ' ');
const row = /const ROW = '([^']*)'/.exec(menu)?.[1] ?? '';

describe('menu items', () => {
  it('lays out link items like button items (links are rendered for navigation items such as Settings)', () => {
    expect(menu).toMatch(/<Link[^>]*role="menuitem"[^>]*className=\{`[^`]*\$\{ROW\}`\}/);
    expect(menu).toMatch(/<Button[\s\S]*?role="menuitem"[\s\S]*?className=\{`[^`]*\$\{ROW\}`\}/);
    expect(menu).not.toContain('button[role=menuitem]');
    expect(row).toContain('buxa:no-underline');
    expect(row).toContain('buxa:h-[34px]!');
  });

  it('highlights a row on hover and on keyboard focus, without the focus outline', () => {
    expect(row).toContain('buxa:hover:bg-[var(--hover)]!');
    expect(row).toContain('buxa:focus-visible:bg-[var(--hover)]!');
    expect(row).toContain('buxa:focus-visible:outline-none!');
  });
});
