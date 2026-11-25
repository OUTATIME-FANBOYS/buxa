// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class } from '@buxa/contracts';
import { failure } from '@buxa/shared';
import { submitRegistrationAction } from '@/actions/registration';
import { ROUTES } from '@/config/routes';
import { CHILD_RESULT_LIMIT } from '../ChildPicker';
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
// Eight children whose names all match "kid", so the six-match limit shows.
const MANY_CAMPERS = Array.from({ length: 8 }, (_, i) => ({ id: `c-kid-${i + 1}`, name: `Kid ${i + 1}` }));

describe('RegisterForm: children as tags and search', () => {
  let root: Root;
  let host: HTMLDivElement;

  const renderWith = (campers: readonly { id: string; name: string }[]) => {
    act(() => {
      root.render(
        <RegisterForm
          formId="form-1"
          sessions={SESSIONS}
          campers={campers}
          timeZone="UTC"
          clockFormat="24h"
          fields={[]}
        />,
      );
    });
  };

  beforeEach(() => {
    vi.mocked(submitRegistrationAction).mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    renderWith(CAMPERS);
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
  const searchBox = () => {
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search children"]');
    if (!search) {
      throw new Error('no search box');
    }

    return search;
  };
  const typeInSearch = (text: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(searchBox(), text);
      searchBox().dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const resultList = () => host.querySelector<HTMLUListElement>('ul[aria-label="Matching children"]');
  const resultNames = () => Array.from(resultList()?.querySelectorAll('button') ?? []).map(b => b.textContent);
  const pickResult = (name: string) => {
    const button = Array.from(resultList()?.querySelectorAll('button') ?? []).find(b => b.textContent === name);
    if (!button) {
      throw new Error(`no result ${name}`);
    }
    act(() => button.click());
  };
  const chooseChild = (name: string) => {
    typeInSearch(name);
    pickResult(name);
  };
  const childTagNames = () =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('ul[aria-label="Chosen children"] button')).map(b =>
      b.getAttribute('aria-label'),
    );
  const removeChildTag = (name: string) => {
    const remove = host.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${name}"]`);
    act(() => remove?.click());
  };
  const addPersonLink = () => {
    const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('a')).find(a => a.textContent === 'Add a person');
    if (!link) {
      throw new Error('no Add a person link');
    }

    return link;
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
    chooseChild('Ada Lovelace');

    expect(childTagNames()).toEqual(['Remove Ada Lovelace']);
    expect(host.querySelector('fieldset legend')?.textContent).toBe('Ada Lovelace');
  });

  it('removes a child with its x, and the classes chosen for that child leave the submission', () => {
    chooseChild('Ada Lovelace');
    act(() => classBox().click());
    expect(submitted()).toEqual(['c-ada|cls-1']);

    removeChildTag('Ada Lovelace');

    expect(childTagNames()).toEqual([]);
    expect(submitted()).toEqual([]);
  });

  it('lists up to six matches in the flow, under the search and inside the same section', () => {
    renderWith(MANY_CAMPERS);
    typeInSearch('kid');

    expect(CHILD_RESULT_LIMIT).toBe(6);
    expect(resultNames()).toHaveLength(6);
    const list = resultList();
    if (!list) {
      throw new Error('no results list');
    }
    expect(list.closest('.form-section')).toBe(searchBox().closest('.form-section'));
    expect(searchBox().compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('takes a picked match out of the results: it becomes a tag, and the list closes with the search cleared', () => {
    typeInSearch('ada');
    expect(resultNames()).toEqual(['Ada Lovelace']);

    pickResult('Ada Lovelace');

    expect(childTagNames()).toEqual(['Remove Ada Lovelace']);
    expect(resultList()).toBeNull();
    expect(searchBox().value).toBe('');

    typeInSearch('ada');
    expect(resultList()).toBeNull();
    expect(host.textContent).toContain('No one matches');
  });

  it('says No one matches when nothing fits the search, and lists nothing', () => {
    typeInSearch('zzz');

    expect(resultList()).toBeNull();
    expect(host.textContent).toContain('No one matches');
  });

  it('keeps Add a person visible and linked to the add-person page, with or without a search', () => {
    expect(addPersonLink().getAttribute('href')).toBe(ROUTES.newPerson);
    expect(addPersonLink().getAttribute('target')).toBe('_blank');

    typeInSearch('zzz');
    expect(addPersonLink().getAttribute('href')).toBe(ROUTES.newPerson);

    chooseChild('Ada Lovelace');
    expect(addPersonLink().getAttribute('href')).toBe(ROUTES.newPerson);
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
    chooseChild('Ada Lovelace');
    chooseChild('Ben Carter');
    act(() => classBox().click());

    expect(childTagNames()).toEqual(['Remove Ada Lovelace', 'Remove Ben Carter']);
    expect(submitted()).toEqual(['c-ada|cls-1']);
  });
});
