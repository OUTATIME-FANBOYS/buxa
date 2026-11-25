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
const ADA = '22222222-2222-4222-8222-222222222222';
const GRACE = '33333333-3333-4333-8333-333333333333';
const SAM = '66666666-6666-4666-8666-666666666666';

const choices: AssignChoices = {
  sessionId: SESSION_ID,
  campers: [
    { id: ADA, name: 'Ada Lovelace' },
    { id: GRACE, name: 'Grace Hopper' },
  ],
  staff: [{ id: SAM, name: 'Sam Rivera' }],
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

function select(name: string): HTMLSelectElement {
  const found = document.body.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!found) {
    throw new Error(`no select ${name}`);
  }

  return found;
}

/** Chooses an option in a native select the way a user does: the value changes and the change event fires. */
function choose(element: HTMLSelectElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set; // eslint-disable-line @typescript-eslint/unbound-method -- the native setter bypasses React's value tracker, so the change event reaches React
    setter?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** The names of the people the Person picker offers, in order (its options, not the chosen tags). */
function personOptions(): string[] {
  return [...personPicker().options].filter(o => o.value !== '').map(o => o.textContent ?? '');
}

/** The native select the Person picker adds people with. It is not a form field itself: the chosen people are the personId fields. */
function personPicker(): HTMLSelectElement {
  const found = document.body.querySelector<HTMLSelectElement>('select[data-field="person"]');
  if (!found) {
    throw new Error('no person picker');
  }

  return found;
}

/** The people chosen so far: the value of each hidden personId field. */
function chosenIds(): string[] {
  return [...document.body.querySelectorAll<HTMLInputElement>('input[name="personId"]')].map(input => input.value);
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

    for (const name of ['role', 'groupId', 'roomId']) {
      expect(select(name).required, name).toBe(true);
    }
  });
});

describe('placing several people at once', () => {
  it('lists the campers for the Camper role, and the staff for Staff', () => {
    mount(popUp());

    expect(personOptions()).toEqual(['Ada Lovelace', 'Grace Hopper']);
    choose(select('role'), 'staff');
    expect(personOptions()).toEqual(['Sam Rivera']);
  });

  it('adds each chosen person as a removable tag, and posts each one as a personId', () => {
    mount(popUp());

    choose(personPicker(), ADA);
    choose(personPicker(), GRACE);

    expect(chosenIds()).toEqual([ADA, GRACE]);
    const tags = [...document.body.querySelectorAll('.session-tag')].map(tag =>
      tag.textContent?.replace('×', '').trim(),
    );
    expect(tags).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });

  it('removes a chosen person when its tag is removed', () => {
    mount(popUp());
    choose(personPicker(), ADA);
    choose(personPicker(), GRACE);

    const remove = document.body.querySelector<HTMLButtonElement>('button[aria-label="Remove Ada Lovelace"]');
    act(() => {
      remove?.click();
    });

    expect(chosenIds()).toEqual([GRACE]);
  });

  it('drops the chosen people who are not in the list when the role changes', () => {
    mount(popUp());
    choose(personPicker(), ADA);

    choose(select('role'), 'staff');

    expect(chosenIds()).toEqual([]);
  });
});
