// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class } from '@buxa/contracts';
import { failure } from '@buxa/shared';
import { submitRegistrationAction } from '@/actions/registration';
import { RegisterForm } from '../RegisterForm';

vi.mock('@/actions/registration', () => ({
  submitRegistrationAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CLASS: Class = {
  id: 'cls-1',
  sessionId: 's-1',
  sessionName: 'Art',
  name: 'Pottery',
  ageRange: { minAge: 6, maxAge: 12 },
  capacity: 10,
  startsAt: '2026-07-01T09:00:00Z',
  endsAt: '2026-07-01T11:00:00Z',
  location: 'Hall',
  instructorIds: [],
  instructors: [],
  seatsTaken: 0,
  waitlisted: 0,
  price: null,
  datesOutsideSession: false,
  seriesId: 'ser-1',
  occurrenceStatus: 'active',
  cancelReason: null,
};

const SESSIONS = [{ id: 's-1', name: 'Art', classes: [CLASS] }];
const CAMPERS = [
  { id: 'c-ada', name: 'Ada Lovelace' },
  { id: 'c-ben', name: 'Ben Carter' },
];

describe('RegisterForm: children as tags', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.mocked(submitRegistrationAction).mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    act(() => {
      root.render(
        <RegisterForm
          formId="form-1"
          sessions={SESSIONS}
          campers={CAMPERS}
          timeZone="UTC"
          clockFormat="24h"
          fields={[]}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const form = () => {
    const found = host.querySelector('form');
    if (!found) {
      throw new Error('no form');
    }

    return found;
  };
  const childSelect = () => {
    const select = host.querySelector<HTMLSelectElement>('select[data-field="person"]');
    if (!select) {
      throw new Error('no children select');
    }

    return select;
  };
  const chooseChild = (id: string) => {
    act(() => {
      childSelect().value = id;
      childSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  const childTagNames = () =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('ul[aria-label="Chosen people"] button')).map(b =>
      b.getAttribute('aria-label'),
    );
  const removeChildTag = (name: string) => {
    const remove = host.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${name}"]`);
    act(() => remove?.click());
  };
  const classBox = () => {
    const box = host.querySelector<HTMLInputElement>('fieldset input[type="checkbox"]');
    if (!box) {
      throw new Error('no class checkbox');
    }

    return box;
  };
  const submitted = () => new FormData(form()).getAll('selections');

  it('adds a chosen child as a tag and shows that child’s classes', () => {
    chooseChild('c-ada');

    expect(childTagNames()).toEqual(['Remove Ada Lovelace']);
    expect(host.querySelector('fieldset legend')?.textContent).toBe('Ada Lovelace');
  });

  it('removes a child with its x, and the classes chosen for that child leave the submission', () => {
    chooseChild('c-ada');
    act(() => classBox().click());
    expect(submitted()).toEqual(['c-ada|cls-1']);

    removeChildTag('Ada Lovelace');

    expect(childTagNames()).toEqual([]);
    expect(submitted()).toEqual([]);
  });

  it('finds a child by name as you type in the search', () => {
    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) {
      throw new Error('no search box');
    }
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'ben');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const options = Array.from(childSelect().querySelectorAll('option')).map(o => o.textContent);
    expect(options).toEqual(['Add a person', 'Ben Carter']);
  });

  it('asks for a child first: the required message shows when none is chosen and the form is sent', async () => {
    vi.mocked(submitRegistrationAction).mockResolvedValue(
      failure('Check the form.', { selections: 'Choose at least one class.' }),
    );

    act(() => {
      form().requestSubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Choose at least one class.');
  });

  it('submits the chosen child and class unchanged, one selection per class', () => {
    chooseChild('c-ada');
    chooseChild('c-ben');
    act(() => classBox().click());

    expect(childTagNames()).toEqual(['Remove Ada Lovelace', 'Remove Ben Carter']);
    expect(submitted()).toEqual(['c-ada|cls-1']);
  });
});
