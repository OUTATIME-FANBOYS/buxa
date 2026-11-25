// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Group, Room } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { ConfirmDialog } from '@/components/components';
import { AssignBoard } from '../AssignBoard';

vi.mock('@/actions/groups', () => ({ assignAction: vi.fn(), unassignAction: vi.fn() }));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const HAWKS = '22222222-2222-4222-8222-222222222222';
const LODGE = '33333333-3333-4333-8333-333333333333';

const hawks: Group = {
  id: HAWKS,
  sessionId: SESSION_ID,
  name: 'Hawks',
  capacity: 4,
  ratioCampers: 4,
  ageRange: { minAge: 8, maxAge: 12 },
  campers: 0,
  staff: 0,
};
const lodge: Room = { id: LODGE, sessionId: SESSION_ID, name: 'Lodge 1', location: 'North', capacity: 6, campers: 0 };

/** The board as the page renders it, in a real document, so the wrapper and its columns can be queried. */
function boardDocument(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(
    <UiProvider Dialog={ConfirmDialog}>
      <AssignBoard
        sessionId={SESSION_ID}
        canManage
        groups={[hawks]}
        rooms={[lodge]}
        assignments={[]}
        unplaced={[{ id: '44444444-4444-4444-8444-444444444444', name: 'Ada Lovelace' }]}
        choices={{ sessionId: SESSION_ID, campers: [], staff: [], groups: [hawks], rooms: [lodge] }}
      />
    </UiProvider>,
  );
  document.body.appendChild(container);

  return container;
}

describe('the Assign page two-column layout', () => {
  it('wraps the page in one layout element with a groups column and a not-placed column, in that order', () => {
    const container = boardDocument();
    const layout = container.querySelector('.assign-layout');
    const columns = [...(layout?.children ?? [])];

    expect(columns).toHaveLength(2);
    expect(columns[0]?.classList.contains('assign-layout__groups')).toBe(true);
    expect(columns[1]?.classList.contains('assign-layout__unplaced')).toBe(true);
    container.remove();
  });

  it('puts the group cards in the groups column and the campers not placed yet in the other', () => {
    const container = boardDocument();
    const groups = container.querySelector('.assign-layout__groups');
    const unplaced = container.querySelector('.assign-layout__unplaced');

    expect(groups?.querySelector('#group-' + HAWKS)?.textContent).toContain('Hawks');
    expect(groups?.textContent).not.toContain('Campers not placed yet');
    expect(unplaced?.querySelector('#unplaced-heading')?.textContent).toBe('Campers not placed yet');
    container.remove();
  });
});
