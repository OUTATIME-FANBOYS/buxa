import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'components', 'popover-menu-dialog.css'),
  'utf8',
);

describe('menu items', () => {
  it('lays out link items like button items (links are rendered for navigation items such as Settings)', () => {
    expect(css).toContain('.menu [role=menuitem] {');
    expect(css).not.toContain('.menu button[role=menuitem] {');
    expect(css).toContain('.menu [role=menuitem]:hover, .menu [role=menuitem]:focus-visible');
    expect(css).toMatch(/\.menu \[role=menuitem\] \{[^}]*text-decoration: none/);
  });
});
