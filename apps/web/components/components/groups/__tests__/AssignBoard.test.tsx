// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Assignment, Group, Room } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { ConfirmDialog } from '@/components/components';
import { AssignBoard } from '../AssignBoard';

vi.mock('@/actions/groups', () => ({ assignAction: vi.fn(), unassignAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const HAWKS = '22222222-2222-4222-8222-222222222222';
const LODGE = '33333333-3333-4333-8333-333333333333';
const OWEN = '44444444-4444-4444-8444-444444444444';
const ADA = '55555555-5555-4555-8555-555555555555';

const hawks: Group = {
  id: HAWKS,
  sessionId: SESSION_ID,
  name: 'Hawks',
  capacity: 4,
  ratioCampers: 4,
  ageRange: { minAge: 8, maxAge: 12 },
  campers: 2,
  staff: 0,
};
const lodge: Room = { id: LODGE, sessionId: SESSION_ID, name: 'Lodge 1', location: 'North', capacity: 6, campers: 2 };
const placement = (personId: string, personName: string): Assignment => ({
  id: `placement-${personId}`,
  sessionId: SESSION_ID,
  personId,
  personName,
  role: 'camper',
  groupId: HAWKS,
  roomId: LODGE,
  overrideReason: null,
});
const assignments = [placement(OWEN, 'Owen Adeyemi'), placement(ADA, 'Ada Lovelace')];

const board = (canManage: boolean) => (
  <AssignBoard
    sessionId={SESSION_ID}
    canManage={canManage}
    groups={[hawks]}
    rooms={[lodge]}
    assignments={assignments}
    unplaced={[]}
  />
);

/** The row of one placed person, as a table row. */
function rowFor(container: HTMLElement, name: string): HTMLTableRowElement {
  const row = [...container.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes(name));
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`no row for ${name}`);
  }

  return row;
}

let mounted: { root: Root; container: HTMLElement } | null = null;

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted?.root.unmount();
    });
    mounted.container.remove();
    mounted = null;
  }
});

/** Static markup in a real document, so the rows can be queried like the browser sees them. */
function inDocument(canManage: boolean): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{board(canManage)}</UiProvider>);
  document.body.appendChild(container);

  return container;
}

describe('the Assign page board', () => {
  it('lists each placed person as a table row with the name, role and room, then the actions', () => {
    const container = inDocument(true);
    const row = rowFor(container, 'Owen Adeyemi');
    const cells = [...row.children];

    expect(row.querySelector('th')?.textContent).toContain('Owen Adeyemi');
    expect(cells[1]?.textContent).toContain('Camper, Lodge 1');
    container.remove();
  });

  it('puts Unassign in the last cell of the row, right-aligned, as an icon-only button', () => {
    const container = inDocument(true);
    const row = rowFor(container, 'Owen Adeyemi');
    const last = row.lastElementChild;
    const button = last?.querySelector('button');

    expect(last?.className).toContain('classes-actions-cell');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('button--icon-only');
    expect(button?.className).toContain('button--glass');
    container.remove();
  });

  it('gives the icon button the accessible name and tooltip "Unassign <name>", with no visible text', () => {
    const container = inDocument(true);
    const button = rowFor(container, 'Owen Adeyemi').querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe('Unassign Owen Adeyemi');
    expect(button?.getAttribute('title')).toBe('Unassign Owen Adeyemi');
    expect(button?.textContent?.trim()).toBe('');
    container.remove();
  });

  it('hides the Unassign button from a viewer, with no empty actions cell', () => {
    const container = inDocument(false);

    expect(container.querySelector('button[aria-label^="Unassign"]')).toBeNull();
    expect(container.textContent).not.toContain('Unassign');
    container.remove();
  });

  it('opens a confirmation that names the person and the group', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted = { root, container };
    act(() => {
      root.render(<UiProvider Dialog={ConfirmDialog}>{board(true)}</UiProvider>);
    });

    const button = rowFor(container, 'Owen Adeyemi').querySelector('button');
    act(() => {
      button?.click();
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Unassign Owen Adeyemi');
    expect(text).toContain('Remove Owen Adeyemi from Hawks');
  });
});
