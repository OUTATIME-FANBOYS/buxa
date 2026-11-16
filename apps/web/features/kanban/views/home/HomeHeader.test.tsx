import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CampHome } from '../../../../logic/composers/index.server';

vi.mock('../../../camp/forms/RenameCampButton', () => ({ RenameCampButton: () => 'RENAME-BUTTON' }));

Object.assign(globalThis, { React });
const { HomeHeader } = await import('./HomeHeader');

const camp = (canRename: boolean): CampHome => ({ campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename, people: 1, onSite: 0, validMemberships: 1 });

describe('HomeHeader', () => {
  it('greets the person by name with the camp as context', () => {
    const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={camp(false)} />);
    expect(html).toMatch(/Good (morning|afternoon|evening), Priya/);
    expect(html).toContain('Lake Camp');
  });

  it.each([[true, true], [false, false]])('shows Rename when canRename is %s: %s', (canRename, shown) => {
    const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={camp(canRename)} />);
    expect(html.includes('RENAME-BUTTON')).toBe(shown);
  });

  it('has no Rename action without a camp', () => {
    const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={null} />);
    expect(html).not.toContain('RENAME-BUTTON');
    expect(html).toContain('Your tasks, kept in this browser');
  });
});
