// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { ConfirmDialog } from '@/components/components';
import { UnplacedCampers, type UnplacedPerson } from '../UnplacedCampers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const people: UnplacedPerson[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Ada Lovelace' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Grace Hopper' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'José Álvarez' },
];

let mounted: { root: Root; container: HTMLElement } | null = null;

function mount(list: readonly UnplacedPerson[]): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UnplacedCampers people={list} />);
  });
  mounted = { root, container };

  return container;
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

function searchBox(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) {
    throw new Error('no search box');
  }

  return input;
}

/** Types into the search box the way a user does: the value changes and the input event fires. */
function type(input: HTMLInputElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; // eslint-disable-line @typescript-eslint/unbound-method -- the native setter bypasses React's value tracker, so the input event reaches React
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** The names shown in the list, in order. */
function shownNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ul.unplaced-list li')].map(li => li.textContent ?? '');
}

describe('the campers not placed yet', () => {
  it('lists every unplaced camper in a labelled list, with no fixed-height scroll', () => {
    const container = mount(people);
    const list = container.querySelector('ul.unplaced-list');

    expect(shownNames(container)).toEqual(['Ada Lovelace', 'Grace Hopper', 'José Álvarez']);
    expect(list?.getAttribute('aria-label')).toBe('Campers not placed yet');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('shows ten campers to a page, with Previous and Next under the list', () => {
    const many = Array.from({ length: 23 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `Camper ${index + 1}`,
    }));
    const container = mount(many);

    expect(shownNames(container)).toHaveLength(10);
    expect(container.textContent).toContain('Showing 1–10 of 23');
    expect(container.querySelector('button[aria-label="Previous page"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Next page"]')).toBeTruthy();
  });

  it('pages the search results, not the whole list, and returns to page 1 on a new search', () => {
    const many = Array.from({ length: 23 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: index < 15 ? `Other ${index + 1}` : `Camper ${index + 1}`,
    }));
    const container = mount(many);
    const next = () => container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');

    act(() => {
      next()?.click();
    });
    type(searchBox(container), 'camper');

    expect(shownNames(container)).toHaveLength(8);
    // One page of matches: no pager, so no range line either.
    expect(container.textContent).not.toContain('Showing');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('filters the list by name as the user types', () => {
    const container = mount(people);

    type(searchBox(container), 'grace');

    expect(shownNames(container)).toEqual(['Grace Hopper']);
  });

  it('matches without case and without accents', () => {
    const container = mount(people);

    type(searchBox(container), 'JOSE');

    expect(shownNames(container)).toEqual(['José Álvarez']);
  });

  it('shows a short message when nothing matches', () => {
    const container = mount(people);

    type(searchBox(container), 'zzz');

    expect(shownNames(container)).toEqual([]);
    expect(container.textContent).toContain('No campers match');
  });

  it('clears the search with the clear button, and restores the whole list', () => {
    const container = mount(people);
    type(searchBox(container), 'grace');

    const clear = container.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]');
    act(() => {
      clear?.click();
    });

    expect(searchBox(container).value).toBe('');
    expect(shownNames(container)).toEqual(['Ada Lovelace', 'Grace Hopper', 'José Álvarez']);
  });

  it('says every camper is placed when none is left to place, and offers no search', () => {
    const container = mount([]);

    expect(container.textContent).toContain('Every camper is placed.');
    expect(container.querySelector('input[type="search"]')).toBeNull();
  });

  it('has no Place button on any row, even for a viewer who may place', () => {
    const container = mountWithChoices(people);

    expect(container.querySelector('ul.unplaced-list button')).toBeNull();
    expect(container.querySelectorAll('ul.unplaced-list li')).toHaveLength(3);
  });

  it('has no Place button in the card for a viewer (no choices are passed)', () => {
    const container = mount(people);

    expect(container.querySelector('.unplaced-head button')).toBeNull();
  });

  it('shows one Place button in the card header, beside the title and above the search', () => {
    const container = mountWithChoices(people);
    const header = container.querySelector('.unplaced-head');
    if (!header) {
      throw new Error('no header line');
    }

    expect(container.querySelectorAll('.unplaced-head button')).toHaveLength(1);
    expect(header.querySelector('button')?.textContent).toBe('Place');
    expect(header.querySelector('h2')?.textContent).toBe('Campers not placed yet');
    expect(header.compareDocumentPosition(searchBox(container)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the Place pop-up with nobody chosen from the header button', () => {
    const container = mountWithChoices(people);

    act(() => {
      container.querySelector<HTMLButtonElement>('.unplaced-head button')?.click();
    });

    expect(document.body.textContent).toContain('Place or move a person');
    expect(document.body.querySelectorAll('.session-tag')).toHaveLength(0);
  });

  it('keeps the search and the paging working with the Place button shown', () => {
    const many = Array.from({ length: 23 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `Camper ${index + 1}`,
    }));
    const container = mountWithChoices(many);

    expect(shownNames(container)).toHaveLength(10);
    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click();
    });
    type(searchBox(container), 'camper 2');

    expect(shownNames(container)).toEqual(['Camper 2', 'Camper 20', 'Camper 21', 'Camper 22', 'Camper 23']);
    expect(container.querySelectorAll('.unplaced-head button')).toHaveLength(1);
  });
});

function mountWithChoices(list: readonly UnplacedPerson[]): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const choices = { sessionId: 'session-1', campers: list, staff: [], groups: [], rooms: [] };
  act(() => {
    root.render(
      <UiProvider Dialog={ConfirmDialog}>
        <UnplacedCampers people={list} choices={choices} />
      </UiProvider>,
    );
  });
  mounted = { root, container };

  return container;
}
