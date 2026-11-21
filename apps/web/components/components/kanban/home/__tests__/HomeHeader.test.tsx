import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CampHome } from '@buxa/server/composers/index.server';

vi.mock('@/components/components/camp/RenameCampButton', () => ({ RenameCampButton: () => 'RENAME-BUTTON' }));
Object.assign(globalThis, { React });
const { HomeHeader } = await import('@/components/components/kanban/home');

const camp = (canRename: boolean): CampHome => ({
  campId: 'o1',
  name: 'Lake Camp',
  firstName: 'Priya',
  canRename,
  people: 1,
  onSite: 0,
  checkedInToday: 0,
  validMemberships: 1,
  upcomingSessions: [],
  checkInsByDay: null,
  onSiteByAge: null,
  membershipStatus: null,
});

describe('HomeHeader', () => {
  it('greets the person by name with the camp as context', () => {
    const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={camp(false)} />);
    expect(html).toMatch(/Good (morning|afternoon|evening), Priya/);
    expect(html).toContain('Lake Camp');
  });

  it.each([true, false])(
    'has no Rename action on Home, even when canRename is %s (rename lives in Settings)',
    canRename => {
      const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={camp(canRename)} />);
      expect(html).not.toContain('RENAME-BUTTON');
      expect(html).not.toContain('>Rename<');
    },
  );

  it('shows the camp context without a camp', () => {
    const html = renderToStaticMarkup(<HomeHeader firstName="Priya" camp={null} />);
    expect(html).toContain('Your tasks, kept in this browser');
  });
});
