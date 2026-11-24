// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { NewClassButton, NewSessionButton } from '@/components/components/classes/forms';
import { UiProvider } from '@buxa/middleware/providers/providers';

const NoDialog = () => null;
const SESSION = '11111111-1111-4111-8111-111111111111';
const NO_WEEKDAY = 'Tick at least one day of the week.';

const actions = vi.hoisted(() => ({
  createSessionAction: vi.fn(),
  addClassAction: vi.fn(),
  addSeriesAction: vi.fn(),
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
  actions.addSeriesAction.mockResolvedValue({ status: 'success', message: 'Added 3 classes.' });
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
const setValue = (name: string, value: string) => {
  const field = input(name);
  if (!field) {
    throw new Error(`no field ${name}`);
  }
  act(() => {
    field.value = value;
  });
};
/** A day chip, found by its accessible name (Monday) or its visible text (All). */
const chip = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.weekday-row button')].find(
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

describe('the New class dialog: every class is set on weekdays', () => {
  it('has no Specific days checkbox and no one-class toggle', () => {
    openDialog();

    expect(shownText()).not.toContain('Specific days');
    expect(document.querySelector('#new-class-form input[type="checkbox"]')).toBeNull();
  });

  it('shows the day chips All, M, T, W, T, F, S, S, with Monday to Friday pressed by default', () => {
    openDialog();

    const labels = [...document.querySelectorAll<HTMLButtonElement>('.weekday-row button')].map(b => b.textContent);
    expect(labels).toEqual(['All', 'M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(chipPressed('All')).toBe('false');
    expect(chipPressed('Monday')).toBe('true');
    expect(chipPressed('Tuesday')).toBe('true');
    expect(chipPressed('Wednesday')).toBe('true');
    expect(chipPressed('Thursday')).toBe('true');
    expect(chipPressed('Friday')).toBe('true');
    expect(chipPressed('Saturday')).toBe('false');
    expect(chipPressed('Sunday')).toBe('false');
    expect(postedWeekdays()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('places the day chips after Starts and Ends, and before Location', () => {
    openDialog();
    const text = shownText();

    expect(text.indexOf('Starts')).toBeLessThan(text.indexOf('Ends'));
    expect(text.indexOf('Ends')).toBeLessThan(text.indexOf('Days of the week'));
    expect(text.indexOf('Days of the week')).toBeLessThan(text.indexOf('Location'));
  });

  it('clicking one day toggles only that day', () => {
    openDialog();

    clickChip('Wednesday');
    expect(chipPressed('Wednesday')).toBe('false');
    expect(chipPressed('Monday')).toBe('true');
    expect(postedWeekdays()).toEqual(['1', '2', '4', '5']);

    clickChip('Saturday');
    expect(chipPressed('Saturday')).toBe('true');
    expect(postedWeekdays()).toEqual(['1', '2', '4', '5', '6']);
  });

  it('All selects all seven days, and a second press on All clears them', () => {
    openDialog();

    clickChip('All');
    expect(chipPressed('All')).toBe('true');
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      expect(chipPressed(day), day).toBe('true');
    }
    expect(postedWeekdays()).toEqual(['1', '2', '3', '4', '5', '6', '7']);

    clickChip('All');
    expect(chipPressed('All')).toBe('false');
    expect(postedWeekdays()).toEqual([]);
  });

  it('no days selected: the form does not submit, and the weekday message shows under the row', async () => {
    openDialog();
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      clickChip(day);
    }
    setValue('startsAt', '2027-07-05T09:00');
    setValue('endsAt', '2027-07-30T10:30');

    await submit();

    expect(actions.addSeriesAction).not.toHaveBeenCalled();
    expect(actions.addClassAction).not.toHaveBeenCalled();
    expect(document.querySelector('.weekday-row')?.parentElement?.textContent).toContain(NO_WEEKDAY);
  });

  it('submits the recurring request with the chosen days and the Starts and Ends date-times', async () => {
    openDialog();
    clickChip('Tuesday');
    clickChip('Thursday');
    setValue('startsAt', '2027-07-05T09:00');
    setValue('endsAt', '2027-07-30T10:30');

    await submit();

    expect(actions.addClassAction).not.toHaveBeenCalled();
    expect(actions.addSeriesAction).toHaveBeenCalledTimes(1);
    const data = postedTo(actions.addSeriesAction);
    expect(data.getAll('weekdays')).toEqual(['1', '3', '5']);
    expect(data.get('startsAt')).toBe('2027-07-05T09:00');
    expect(data.get('endsAt')).toBe('2027-07-30T10:30');
    expect(data.has('firstDate')).toBe(false);
  });

  it('shows the server refusal for a series and keeps the dialog open', async () => {
    actions.addSeriesAction.mockResolvedValue({
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

  it('keeps Starts and Ends required: their refusal shows on the field', async () => {
    actions.addSeriesAction.mockResolvedValue({
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { startsAt: 'Enter a date and time.', endsAt: 'Enter a date and time.' },
    });
    openDialog();

    await submit();

    expect(shownText()).toContain('Enter a date and time.');
    expect(actions.addSeriesAction).toHaveBeenCalledTimes(1);
  });
});
