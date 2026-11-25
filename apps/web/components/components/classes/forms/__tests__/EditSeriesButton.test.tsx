// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Series } from '@buxa/contracts';
import { EditSeriesButton, NewClassButton } from '@/components/components/classes/forms';
import { UiProvider } from '@buxa/middleware/providers/providers';

const NoDialog = () => null;
const SESSION = '11111111-1111-4111-8111-111111111111';
const SERIES = '22222222-2222-4222-8222-222222222222';
const INSTRUCTOR = '33333333-3333-4333-8333-333333333333';
const INTRO_NEW = 'Fields marked with an asterisk are required.';

const actions = vi.hoisted(() => ({
  addSeriesAction: vi.fn(),
  updateSeriesAction: vi.fn(),
}));
vi.mock('@/actions/classes', () => actions);

/** A saved series: Mondays and Wednesdays from 5 to 19 July 2027, 9:00 to 12:00, with one instructor and a price. */
const series = (over: Partial<Series> = {}): Series => ({
  id: SERIES,
  sessionId: SESSION,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  location: 'Lab 1',
  weekdays: [1, 3],
  startTime: '09:00',
  endTime: '12:00',
  firstDay: '2027-07-05',
  lastDay: '2027-07-19',
  startsLocal: '2027-07-05T09:00',
  endsLocal: '2027-07-19T12:00',
  occurrenceCount: 3,
  activeOccurrenceCount: 3,
  anchorClassId: '55555555-5555-4555-8555-555555555555',
  instructorIds: [INSTRUCTOR],
  instructors: [{ id: INSTRUCTOR, name: 'Ana Ruiz' }],
  price: { currency: 'AUD', regularMinor: 4500, earlyBirdMinor: null, earlyBirdUntil: null },
  seatsTaken: 0,
  waitlisted: 0,
  ...over,
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function renderEdit(edited: Series = series(), detailsOnly = false) {
  act(() => {
    root.render(
      <UiProvider Dialog={NoDialog}>
        <EditSeriesButton
          series={edited}
          sessionName="Summer camp"
          instructors={[{ id: INSTRUCTOR, name: 'Ana Ruiz' }]}
          detailsOnly={detailsOnly}
        />
      </UiProvider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.updateSeriesAction.mockResolvedValue({ status: 'success', message: 'Class saved.' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const EDIT_FORM = `form#edit-series-${SERIES}`;
const openEdit = (name = 'Robotics') => {
  act(() => {
    document.querySelector<HTMLButtonElement>(`button[aria-label="Edit ${name}"]`)?.click();
  });
};
const form = () => document.querySelector<HTMLFormElement>(EDIT_FORM);
const input = (name: string) => document.querySelector<HTMLInputElement>(`${EDIT_FORM} [name="${name}"]`);
const setValue = (name: string, value: string) => {
  const field = input(name);
  if (!field) {
    throw new Error(`no field ${name}`);
  }
  act(() => {
    field.value = value;
  });
};
const chip = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(`${EDIT_FORM} .weekday-row button`)].find(
    button => button.getAttribute('aria-label') === label || button.textContent === label,
  );
const chipPressed = (label: string) => chip(label)?.getAttribute('aria-pressed');
const clickChip = (label: string) => {
  act(() => chip(label)?.click());
};
const postedWeekdays = () =>
  [...(form()?.querySelectorAll<HTMLInputElement>('input[name="weekdays"]') ?? [])].map(field => field.value);
const submit = async () => {
  await act(() => {
    form()?.requestSubmit();

    return Promise.resolve();
  });
};
const postedTo = (call = 0): FormData => {
  const data: unknown = actions.updateSeriesAction.mock.calls[call]?.[1];
  if (!(data instanceof FormData)) {
    throw new Error('expected the edit to be posted');
  }

  return data;
};

describe('Edit class: the New class form, prefilled from the series', () => {
  it('opens the same form as New class, with every field filled from the series', () => {
    renderEdit();
    openEdit();

    expect(input('name')?.value).toBe('Robotics');
    expect(input('minAge')?.value).toBe('8');
    expect(input('maxAge')?.value).toBe('12');
    expect(input('capacity')?.value).toBe('12');
    expect(input('startsAt')?.value).toBe('2027-07-05T09:00');
    expect(input('endsAt')?.value).toBe('2027-07-19T12:00');
    expect(input('location')?.value).toBe('Lab 1');
    expect(input('priceAmount')?.value).toMatch(/^45(\.00)?$/);
    expect(form()?.textContent).toContain('Ana Ruiz');
  });

  it('shows the Days of the week chips with the series days pressed', () => {
    renderEdit();
    openEdit();

    const labels = [...document.querySelectorAll<HTMLButtonElement>(`${EDIT_FORM} .weekday-row button`)].map(
      b => b.textContent,
    );
    expect(labels).toEqual(['All', 'M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(chipPressed('Monday')).toBe('true');
    expect(chipPressed('Tuesday')).toBe('false');
    expect(chipPressed('Wednesday')).toBe('true');
    expect(chipPressed('Friday')).toBe('false');
    expect(postedWeekdays()).toEqual(['1', '3']);
  });

  it('has the same intro line as New class, and not the old per-day wording', () => {
    renderEdit();
    openEdit();

    expect(form()?.textContent).toContain(INTRO_NEW);
    expect(form()?.textContent).toContain('The class must fall on days inside Summer camp.');
    expect(form()?.textContent).not.toContain('These changes apply');
  });

  it('has Cancel and Save class in the pinned footer, tied to the form, as New class has Add class', () => {
    renderEdit();
    openEdit();

    const foot = document.querySelector('.dialog-foot');
    expect(foot?.textContent).toContain('Save class');
    expect(foot?.textContent).toContain('Cancel');
    expect(foot?.textContent).not.toContain('Add class');
    expect(document.querySelector(`button[form="edit-series-${SERIES}"]`)).not.toBeNull();
  });

  it('the New class form, opened from the session page, has the same intro and footer shape', () => {
    act(() => {
      root.render(
        <UiProvider Dialog={NoDialog}>
          <NewClassButton sessionId={SESSION} sessionName="Summer camp" instructors={[]} />
        </UiProvider>,
      );
    });
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    });

    const foot = document.querySelector('.dialog-foot');
    expect(document.querySelector('form#new-class-form')?.textContent).toContain(INTRO_NEW);
    expect(foot?.textContent).toContain('Add class');
    expect(foot?.textContent).toContain('Cancel');
  });
});

describe('Edit class: saving', () => {
  it('a change to the name alone posts the series id and the form, and closes the dialog on success', async () => {
    renderEdit();
    openEdit();

    setValue('name', 'Sketching');
    await submit();

    expect(actions.updateSeriesAction).toHaveBeenCalledTimes(1);
    const data = postedTo();
    expect(data.get('seriesId')).toBe(SERIES);
    expect(data.get('sessionId')).toBe(SESSION);
    expect(data.get('name')).toBe('Sketching');
    expect(data.getAll('weekdays')).toEqual(['1', '3']);
    expect(data.get('startsAt')).toBe('2027-07-05T09:00');
    expect(data.get('endsAt')).toBe('2027-07-19T12:00');
    expect(form()).toBeNull();
  });

  it('posts the days as the chips leave them, so a change of days is sent with the edit', async () => {
    renderEdit();
    openEdit();

    clickChip('Friday');
    await submit();

    expect(postedTo().getAll('weekdays')).toEqual(['1', '3', '5']);
  });

  it('keeps the dialog open and shows the refusal when the server refuses the edit', async () => {
    actions.updateSeriesAction.mockResolvedValue({
      status: 'error',
      message:
        'Mia Patel is in Robotics on Mon 12 Jul, which this change removes. Unenrol them first, then save again.',
    });
    renderEdit();
    openEdit();

    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Mia Patel');
    expect(form()).not.toBeNull();
  });
});

describe('Edit class: a teacher on the series', () => {
  it('sees the name only, and posts only the name with detailsOnly', async () => {
    renderEdit(series(), true);
    openEdit();

    expect(input('name')).not.toBeNull();
    expect(input('capacity')).toBeNull();
    expect(input('startsAt')).toBeNull();
    expect(chip('Monday')).toBeUndefined();

    setValue('name', 'Sketching');
    await submit();

    expect(postedTo().get('detailsOnly')).toBe('yes');
    expect(postedTo().get('name')).toBe('Sketching');
  });
});
