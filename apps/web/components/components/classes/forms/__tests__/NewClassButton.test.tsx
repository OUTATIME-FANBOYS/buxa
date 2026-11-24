// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { NewClassButton, NewSessionButton } from '@/components/components/classes/forms';
import { UiProvider } from '@buxa/middleware/providers/providers';

const NoDialog = () => null;
const SESSION = '11111111-1111-4111-8111-111111111111';

const actions = vi.hoisted(() => ({
  createSessionAction: vi.fn(),
  addClassAction: vi.fn(),
  addRecurringClassesAction: vi.fn(),
  updateClassAction: vi.fn(),
  deleteClassAction: vi.fn(),
}));
vi.mock('@/actions/classes', () => actions);

/** The FormData a mocked action was called with (the action's second argument). */
function postedTo(fn: { mock: { calls: unknown[][] } }, call = 0): FormData {
  const data = fn.mock.calls[call]?.[1];
  if (!(data instanceof FormData)) {
    throw new Error('expected the form to be posted');
  }

  return data;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  actions.addClassAction.mockResolvedValue({ status: 'success', message: 'Class added.' });
  actions.addRecurringClassesAction.mockResolvedValue({ status: 'success', message: 'Added 3 classes.' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <UiProvider Dialog={NoDialog}>
        <NewClassButton sessionId={SESSION} sessionName="Summer camp" instructors={[]} />
      </UiProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const openDialog = () => {
  act(() => {
    document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
  });
};
const form = () => document.querySelector<HTMLFormElement>('form#new-class-form');
const input = (name: string) => document.querySelector<HTMLInputElement>(`#new-class-form [name="${name}"]`);
const specificDays = () =>
  [...document.querySelectorAll('label')].find(label => label.textContent === 'Specific days')?.querySelector('input');
const setValue = (name: string, value: string) => {
  const field = input(name);
  if (!field) {
    throw new Error(`no field ${name}`);
  }
  act(() => {
    field.value = value;
  });
};
const toggleSpecificDays = () => {
  act(() => specificDays()?.click());
};
const submit = async () => {
  await act(() => {
    form()?.requestSubmit();

    return Promise.resolve();
  });
};
const shownText = () => form()?.textContent ?? '';

describe('the New session and New class buttons', () => {
  it('the Sessions page button is labelled New session', () => {
    expect(
      renderToStaticMarkup(
        <UiProvider Dialog={NoDialog}>
          <NewSessionButton />
        </UiProvider>,
      ),
    ).toContain('New session');
  });

  it('the session page button is labelled New class, and is not the old New session label', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={NoDialog}>
        <NewClassButton sessionId={SESSION} sessionName="Summer camp" instructors={[]} />
      </UiProvider>,
    );
    expect(html).toContain('New class');
    expect(html).not.toContain('New session');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});

describe('the New class dialog: its pinned footer', () => {
  it('opens a pop-up whose Add class and Cancel sit in the pinned footer, tied to the form', () => {
    openDialog();
    const foot = document.querySelector('.dialog-foot');
    const body = document.querySelector('.dialog-body');
    expect(foot?.textContent).toContain('Add class');
    expect(foot?.textContent).toContain('Cancel');
    expect(body?.contains(foot ?? null)).toBe(false);
    expect(form()).not.toBeNull();
    expect(document.querySelector('button[form="new-class-form"]')).not.toBeNull();
  });

  it('marks each required field once, with no double asterisk', () => {
    openDialog();
    expect(form()?.textContent ?? '').not.toContain('* *');
    expect(document.querySelectorAll('.field-required').length).toBeGreaterThan(0);
  });
});

describe('the New class dialog: the default one-class form', () => {
  it('starts with one class: Starts and Ends date-times, and the Specific days toggle off', () => {
    openDialog();

    expect(input('startsAt')?.type).toBe('datetime-local');
    expect(input('endsAt')?.type).toBe('datetime-local');
    expect(document.querySelector('[name="weekdays"]')).toBeNull();
    expect(specificDays()?.checked).toBe(false);
  });

  it('submits one class with its start and end date-times, and no recurring fields', async () => {
    openDialog();
    setValue('startsAt', '2027-07-05T09:00');
    setValue('endsAt', '2027-07-05T10:30');

    await submit();

    expect(actions.addClassAction).toHaveBeenCalledTimes(1);
    expect(actions.addRecurringClassesAction).not.toHaveBeenCalled();
    const data = postedTo(actions.addClassAction);
    expect(data.get('startsAt')).toMatch(/^2027-07-0\dT\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(data.get('endsAt')).toMatch(/^2027-07-0\dT\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(data.has('weekdays')).toBe(false);
  });

  it('shows the server refusal for a class outside the session dates, and keeps the dialog open', async () => {
    actions.addClassAction.mockResolvedValue({
      status: 'error',
      message: 'The class falls outside the session dates. Change the session dates first.',
    });
    openDialog();

    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      'The class falls outside the session dates. Change the session dates first.',
    );
    expect(form()).not.toBeNull();
  });
});

describe('the New class dialog: the Specific days form', () => {
  it('turning it on shows the weekdays and keeps Starts and Ends, with no first day, last day, time-only fields or Stops', () => {
    openDialog();
    toggleSpecificDays();

    expect(specificDays()?.checked).toBe(true);
    expect(document.querySelectorAll('[name="weekdays"]')).toHaveLength(7);
    expect(input('startsAt')?.type).toBe('datetime-local');
    expect(input('endsAt')?.type).toBe('datetime-local');
    for (const name of ['firstDate', 'endDate', 'startTime', 'endTime', 'endKind', 'endCount']) {
      expect(input(name), name).toBeNull();
    }
    const text = shownText();
    expect(text).not.toContain('First day');
    expect(text).not.toContain('Last day');
    expect(text).not.toContain('Stops');
    expect(text).not.toContain('Number of classes');
  });

  it('turning it off again returns the default one-class form', () => {
    openDialog();
    toggleSpecificDays();
    toggleSpecificDays();

    expect(specificDays()?.checked).toBe(false);
    expect(document.querySelector('[name="weekdays"]')).toBeNull();
    expect(input('startsAt')?.type).toBe('datetime-local');
  });

  it('requires at least one weekday: the refusal shows under the weekday row, and nothing is added', async () => {
    actions.addRecurringClassesAction.mockResolvedValue({
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { weekdays: 'Tick at least one day of the week.' },
    });
    openDialog();
    toggleSpecificDays();
    setValue('startsAt', '2027-07-05T09:00');
    setValue('endsAt', '2027-07-30T10:30');

    await submit();

    expect(document.querySelector('.weekday-row')?.parentElement?.textContent).toContain(
      'Tick at least one day of the week.',
    );
    expect(actions.addClassAction).not.toHaveBeenCalled();
  });

  it('keeps Starts and Ends required: their refusal shows on the field', async () => {
    actions.addRecurringClassesAction.mockResolvedValue({
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { startsAt: 'Enter a date and time.', endsAt: 'Enter a date and time.' },
    });
    openDialog();
    toggleSpecificDays();
    const weekday = document.querySelector<HTMLInputElement>('[name="weekdays"][value="1"]');
    act(() => weekday?.click());

    await submit();

    expect(shownText()).toContain('Enter a date and time.');
    expect(actions.addRecurringClassesAction).toHaveBeenCalledTimes(1);
  });

  it('posts the ticked weekdays with Starts and Ends as typed, to the recurring path only', async () => {
    openDialog();
    toggleSpecificDays();
    act(() => document.querySelector<HTMLInputElement>('[name="weekdays"][value="2"]')?.click());
    act(() => document.querySelector<HTMLInputElement>('[name="weekdays"][value="4"]')?.click());
    setValue('startsAt', '2027-07-05T09:00');
    setValue('endsAt', '2027-07-30T10:30');

    await submit();

    expect(actions.addClassAction).not.toHaveBeenCalled();
    expect(actions.addRecurringClassesAction).toHaveBeenCalledTimes(1);
    const data = postedTo(actions.addRecurringClassesAction);
    expect(data.getAll('weekdays')).toEqual(['2', '4']);
    expect(data.get('startsAt')).toBe('2027-07-05T09:00');
    expect(data.get('endsAt')).toBe('2027-07-30T10:30');
  });
});
