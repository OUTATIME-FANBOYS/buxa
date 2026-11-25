// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationSeries } from '@buxa/contracts';
import { failure, type CamperRecord } from '@buxa/shared';
import { submitRegistrationAction } from '@/actions/registration';
import { ROUTES } from '@/config/routes';
import { CHILD_RESULT_LIMIT } from '../ChildPicker';
import { RegisterForm, type RegisterSession } from '../RegisterForm';
import { camper } from './camperFixture';

vi.mock('@/actions/registration', () => ({
  submitRegistrationAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A series of five weekday days, 09:00 to 11:00 camp time (UTC in these tests). Its anchor is its first day. */
const DAYS = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'] as const;
const SERIES: RegistrationSeries = {
  id: 'ser-1',
  sessionId: 's-1',
  sessionName: 'Art',
  name: 'Pottery',
  ageRange: { minAge: 6, maxAge: 12 },
  capacity: 10,
  location: 'Hall',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '11:00',
  firstDay: DAYS[0],
  lastDay: DAYS[4],
  startsLocal: '2026-07-06T09:00',
  endsLocal: '2026-07-10T11:00',
  occurrenceCount: 5,
  activeOccurrenceCount: 5,
  anchorClassId: 'cls-1',
  instructorIds: [],
  instructors: [],
  price: null,
  seatsTaken: 0,
  waitlisted: 0,
  occurrences: DAYS.map(day => ({ startsAt: `${day}T09:00:00Z`, endsAt: `${day}T11:00:00Z` })),
};

const SESSIONS: RegisterSession[] = [{ id: 's-1', name: 'Art', series: [SERIES] }];
const CAMPERS = [camper('c-ada', 'Ada', 'Lovelace'), camper('c-ben', 'Ben', 'Carter')];
// Eight children whose names all match "kid", so the six-match limit shows.
const MANY_CAMPERS = Array.from({ length: 8 }, (_, i) => camper(`c-kid-${i + 1}`, 'Kid', `${i + 1}`));

describe('RegisterForm: children as tags and search', () => {
  let root: Root;
  let host: HTMLDivElement;

  const renderWith = (campers: readonly CamperRecord[], sessions: readonly RegisterSession[] = SESSIONS) => {
    act(() => {
      root.render(
        <RegisterForm
          formId="form-1"
          sessions={sessions}
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
  const classesSection = () => {
    const section = host.querySelector<HTMLElement>('section[aria-labelledby="register-classes"]');
    if (!section) {
      throw new Error('no Classes section');
    }

    return section;
  };
  const submitted = () => new FormData(form()).getAll('selections');

  it('adds a chosen child as a tag and shows that child’s classes', () => {
    chooseChild('Ada Lovelace');

    expect(childTagNames()).toEqual(['Remove Ada Lovelace']);
    expect(classesSection().querySelector('fieldset')?.getAttribute('aria-label')).toBe('Ada Lovelace');
  });

  it('shows neither the child name nor the session name as visible text in the Classes section', () => {
    chooseChild('Ada Lovelace');
    const section = classesSection();

    // The name is only in the visually hidden legend, so screen readers still hear which child the choices belong to.
    const named = Array.from(section.querySelectorAll('*')).filter(el => el.textContent === 'Ada Lovelace');
    expect(named.map(el => el.className)).toEqual(['sr-only']);
    // The session's name line is gone: the choices sit straight under the child, with no muted paragraph in between.
    expect(section.querySelector('fieldset')?.querySelector('p')).toBeNull();
    expect(section.textContent).not.toContain('Art');
    // The series choices and their checkboxes stay.
    expect(section.querySelectorAll('fieldset input[type="checkbox"]')).toHaveLength(1);
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

  it('lists a series once, not once per day: five days show as one choice with its days, times and places', () => {
    chooseChild('Ada Lovelace');

    const boxes = host.querySelectorAll('fieldset input[type="checkbox"]');
    expect(boxes).toHaveLength(1);
    const label = host.querySelector('fieldset')?.textContent ?? '';
    expect(label).toContain('Pottery');
    expect(label).toContain('Mon to Fri');
    expect(label).toContain('09:00 to 11:00');
    expect(label).toContain('10 places left');
  });

  it('says Full: waitlist on a series with no place left', () => {
    renderWith(CAMPERS, [{ id: 's-1', name: 'Art', series: [{ ...SERIES, seatsTaken: 10 }] }]);
    chooseChild('Ada Lovelace');

    expect(host.querySelector('fieldset')?.textContent).toContain('Full: waitlist');
  });

  it('enrols a child in a series once: the choice submits the series anchor, one per child', () => {
    chooseChild('Ada Lovelace');
    chooseChild('Ben Carter');
    const boxes = host.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]');
    act(() => boxes.forEach(box => box.click()));

    expect(submitted()).toEqual(['c-ada|cls-1', 'c-ben|cls-1']);
  });

  it('refuses two series with a day that overlaps for one child, even when their first days do not clash', () => {
    const swimming: RegistrationSeries = {
      ...SERIES,
      id: 'ser-2',
      name: 'Swimming',
      anchorClassId: 'cls-2',
      occurrences: [{ startsAt: '2026-07-08T10:30:00Z', endsAt: '2026-07-08T12:00:00Z' }],
    };
    renderWith(CAMPERS, [{ id: 's-1', name: 'Art', series: [SERIES, swimming] }]);
    chooseChild('Ada Lovelace');
    const boxes = host.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]');
    act(() => boxes[0]?.click());
    act(() => boxes[1]?.click());

    expect(host.textContent).toContain('This clashes with Pottery');
    expect(submitted()).toEqual(['c-ada|cls-1']);
  });

  it('lets one child take two series whose days never overlap', () => {
    const swimming: RegistrationSeries = {
      ...SERIES,
      id: 'ser-2',
      name: 'Swimming',
      anchorClassId: 'cls-2',
      occurrences: DAYS.map(day => ({ startsAt: `${day}T13:00:00Z`, endsAt: `${day}T14:00:00Z` })),
    };
    renderWith(CAMPERS, [{ id: 's-1', name: 'Art', series: [SERIES, swimming] }]);
    chooseChild('Ada Lovelace');
    const boxes = host.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]');
    act(() => boxes[0]?.click());
    act(() => boxes[1]?.click());

    expect(submitted()).toEqual(['c-ada|cls-1', 'c-ada|cls-2']);
  });
});
