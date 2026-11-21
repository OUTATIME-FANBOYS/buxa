// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RecurringSeriesButton } from '../RecurringSeriesButton';
import { UiProvider } from '@buxa/middleware/providers/providers';

vi.mock('@/actions/classes', () => ({ addRecurringClassesAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NoDialog = () => null;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <UiProvider Dialog={NoDialog}>
        <RecurringSeriesButton sessionId="11111111-1111-4111-8111-111111111111" />
      </UiProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('RecurringSeriesButton: the weekly series dialog', () => {
  const openDialog = () => {
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    });
  };

  it('opens a pop-up whose Add series and Cancel sit in the pinned footer, tied to the form', () => {
    openDialog();
    const foot = document.querySelector('.dialog-foot');
    const body = document.querySelector('.dialog-body');
    expect(foot?.textContent).toContain('Add series');
    expect(foot?.textContent).toContain('Cancel');
    expect(body?.contains(foot ?? null)).toBe(false);
    expect(document.querySelector('form#weekly-series-form')).not.toBeNull();
    expect(document.querySelector('button[form="weekly-series-form"]')).not.toBeNull();
  });

  it('draws the days of the week as one row with no fieldset box', () => {
    openDialog();
    expect(document.querySelector('fieldset')).toBeNull();
    const row = document.querySelector('.weekday-row');
    expect(row?.querySelectorAll('input[type="checkbox"]')).toHaveLength(7);
  });

  it('marks each required field once, with no double asterisk', () => {
    openDialog();
    const text = document.querySelector('form#weekly-series-form')?.textContent ?? '';
    expect(text).not.toContain('* *');
    expect(document.querySelectorAll('.field-required').length).toBeGreaterThan(0);
  });
});
