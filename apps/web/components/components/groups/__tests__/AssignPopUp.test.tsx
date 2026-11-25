// @vitest-environment jsdom
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { Dialog as ConfirmDialog } from '@/components/components';
import { AssignPopUp, type AssignChoices } from '../AssignDialog';

vi.mock('@/actions/groups', () => ({ assignAction: vi.fn(), unassignAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

const choices: AssignChoices = {
  sessionId: SESSION_ID,
  campers: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Ada Lovelace' }],
  staff: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Sam Rivera' }],
  groups: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      sessionId: SESSION_ID,
      name: 'Hawks',
      capacity: 4,
      ratioCampers: 4,
      ageRange: null,
      campers: 0,
      staff: 0,
    },
  ],
  rooms: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      sessionId: SESSION_ID,
      name: 'Lodge 1',
      location: 'North',
      capacity: 6,
      campers: 0,
    },
  ],
};

// The pop-up is drawn into the page body (a portal), so it is rendered into a real document.
let mounted: { root: Root; container: HTMLElement } | null = null;

function mount(node: ReactElement): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);
  });
  mounted = { root, container };
}

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted?.root.unmount();
    });
    mounted.container.remove();
    mounted = null;
  }
});

const popUp = () => <AssignPopUp choices={choices} onCancel={() => undefined} onDone={() => undefined} />;

/** The label text of each field-required mark's label, in order. */
function requiredLabels(): string[] {
  const labels = [...document.body.querySelectorAll('label')].filter(l => l.querySelector('.field-required'));

  return labels.map(l => l.textContent?.replace(/\s*\*$/, '') ?? '');
}

describe('the Place or move dialog', () => {
  it('marks Role, Person, Group and Room as required with the red field-required mark', () => {
    mount(popUp());

    expect(requiredLabels()).toEqual(['Role', 'Person', 'Group', 'Room']);
    expect(document.body.querySelectorAll('.field-required[aria-hidden="true"]')).toHaveLength(4);
  });

  it('keeps the mark out of the label text, so the label reads as its name alone', () => {
    mount(popUp());

    const personLabel = [...document.body.querySelectorAll('label')].find(l => l.textContent?.startsWith('Person'));
    expect(personLabel?.firstChild?.textContent).toBe('Person');
  });

  it('marks the required selects as required for assistive technology', () => {
    mount(popUp());

    for (const name of ['role', 'personId', 'groupId', 'roomId']) {
      const select = document.body.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
      expect(select?.required, name).toBe(true);
    }
  });
});
