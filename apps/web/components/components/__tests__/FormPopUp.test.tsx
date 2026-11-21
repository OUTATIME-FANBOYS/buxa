// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FormPopUp } from '@/components/components/FormPopUp';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('FormPopUp', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const render = (pending = false, onCancel = vi.fn()) =>
    act(() => {
      root.render(
        <FormPopUp
          title="New session"
          intro="Two weeks in July."
          formId="new-session-form"
          submitLabel="Create session"
          pendingLabel="Saving..."
          submitIcon="plus"
          pending={pending}
          onCancel={onCancel}
          leading={<button type="button">Side action</button>}
        >
          <form id="new-session-form">
            <input name="name" />
          </form>
        </FormPopUp>,
      );
    });
  const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'));
  const cancel = () => buttons().find(b => b.textContent === 'Cancel');
  const submit = () => buttons().find(b => b.getAttribute('form') === 'new-session-form');

  it('renders a glass Cancel and an orange primary submit in the footer, tied to the form by id', () => {
    render();
    expect(cancel()?.classList.contains('button--glass')).toBe(true);
    expect(submit()?.textContent).toBe('Create session');
    expect(submit()?.classList.contains('button--primary')).toBe(true);
    expect(submit()?.getAttribute('type')).toBe('submit');
  });

  it('keeps the body scrollable and the footer outside it', () => {
    render();
    const body = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
    expect(body).not.toBeNull();
    expect(body?.contains(submit() ?? null)).toBe(false);
    expect(body?.textContent).toContain('Two weeks in July.');
  });

  it('shows the pending label and disables both buttons while saving', () => {
    render(true);
    expect(submit()?.textContent).toBe('Saving...');
    expect(submit()?.disabled).toBe(true);
    expect(cancel()?.disabled).toBe(true);
  });

  it('calls onCancel from its Cancel button', () => {
    const onCancel = vi.fn();
    render(false, onCancel);
    act(() => cancel()?.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
