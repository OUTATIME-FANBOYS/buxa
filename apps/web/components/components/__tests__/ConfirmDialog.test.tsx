// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmDialog } from '../ConfirmDialog';
import { buttonClassName } from '@/components/atoms/Button/buttonClass';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The footer's buttons, in the order they are in the DOM. */
function footerButtons(): HTMLButtonElement[] {
  const footer = document.querySelector<HTMLElement>('.dialog-foot');
  if (!footer) {
    throw new Error('Expected a dialog footer.');
  }

  return Array.from(footer.querySelectorAll('button'));
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
}

function setInputValue(input: HTMLInputElement, value: string): void {
  // React listens for the input event, so set the value through the native setter.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ConfirmDialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows the title in the dialog header and the body left aligned', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Delete person"
          confirmLabel="Delete"
          onCancel={() => {}}
          onConfirm={() => {}}
          body={<p>Ada</p>}
        />,
      ),
    );
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Delete person');
    const body = document.querySelector<HTMLElement>('[data-testid="confirm-body"]');
    expect(body?.className).toContain('buxa:text-left');
    expect(body?.className).not.toContain('text-center');
    expect(body?.textContent).toContain('Ada');
  });

  it('puts Cancel before the action in a right aligned footer', () => {
    act(() =>
      root.render(<ConfirmDialog title="Delete" confirmLabel="Delete" onCancel={() => {}} onConfirm={() => {}} />),
    );
    const footer = document.querySelector<HTMLElement>('.dialog-foot');
    expect(footer?.className).toContain('buxa:justify-end');
    expect(footer?.className).not.toContain('justify-center');
    expect(footerButtons().map(b => b.textContent?.trim())).toEqual(['Cancel', 'Delete']);
  });

  it('renders a danger action as the glass-danger button with the trash icon by default', () => {
    act(() =>
      root.render(<ConfirmDialog title="Delete" confirmLabel="Delete" onCancel={() => {}} onConfirm={() => {}} />),
    );
    const action = footerButtons()[1];
    expect(action?.className).toBe(buttonClassName({ variant: 'glass-danger' }));
    expect(action?.querySelector('svg')).not.toBeNull();
    expect(footerButtons()[0]?.className).toBe(buttonClassName({ variant: 'glass' }));
  });

  it('renders a neutral action as a primary button with no trash icon', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Archive camp?"
          variant="neutral"
          confirmLabel="Archive camp"
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      ),
    );
    const action = footerButtons()[1];
    expect(action?.className).toBe(buttonClassName({ variant: 'primary' }));
    expect(action?.querySelector('svg')).toBeNull();
  });

  it('puts an extra action between Cancel and the action', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Session has classes"
          confirmLabel="Delete classes and session"
          onCancel={() => {}}
          onConfirm={() => {}}
          secondaryAction={<button type="button">Archive session</button>}
        />,
      ),
    );
    expect(footerButtons().map(b => b.textContent?.trim())).toEqual([
      'Cancel',
      'Archive session',
      'Delete classes and session',
    ]);
  });

  it('calls onConfirm from the action and onCancel from Cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    act(() =>
      root.render(<ConfirmDialog title="Delete" confirmLabel="Delete" onCancel={onCancel} onConfirm={onConfirm} />),
    );
    act(() => buttonWith('Delete')?.click());
    act(() => buttonWith('Cancel')?.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses cancelLabel for the back step', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Delete"
          confirmLabel="Delete"
          cancelLabel="Back"
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      ),
    );
    expect(footerButtons().map(b => b.textContent?.trim())).toEqual(['Back', 'Delete']);
  });

  it('submits the form named by formId, with the body inside that form', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Delete class?"
          confirmLabel="Delete class"
          onCancel={() => {}}
          formId="delete-class-form"
          formAction={() => {}}
          body={<input type="hidden" name="seriesId" value="s1" />}
        />,
      ),
    );
    const form = document.querySelector<HTMLFormElement>('form#delete-class-form');
    expect(form?.querySelector('input[name="seriesId"]')).not.toBeNull();
    const action = footerButtons()[1];
    expect(action?.type).toBe('submit');
    expect(action?.getAttribute('form')).toBe('delete-class-form');
  });

  it('keeps the action disabled until the typed name matches exactly', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Delete Camp Birchwood"
          confirmLabel="Delete camp"
          onCancel={() => {}}
          onConfirm={() => {}}
          confirmText="Camp Birchwood"
        />,
      ),
    );
    const input = document.querySelector<HTMLInputElement>('input[name="confirmName"]');
    if (!input) {
      throw new Error('Expected the typed-name field.');
    }
    expect(footerButtons()[1]?.disabled).toBe(true);

    act(() => setInputValue(input, 'camp birchwood'));
    expect(footerButtons()[1]?.disabled).toBe(true);

    act(() => setInputValue(input, 'Camp Birchwood'));
    expect(footerButtons()[1]?.disabled).toBe(false);
  });

  it('disables both buttons while pending and shows the pending label', () => {
    act(() =>
      root.render(
        <ConfirmDialog
          title="Delete"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          pending
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      ),
    );
    const [cancel, action] = footerButtons();
    expect(cancel?.disabled).toBe(true);
    expect(action?.disabled).toBe(true);
    expect(action?.textContent?.trim()).toBe('Deleting...');
  });

  it('disables only the action when confirmDisabled is set', () => {
    act(() =>
      root.render(
        <ConfirmDialog title="Delete" confirmLabel="Delete" confirmDisabled onCancel={() => {}} onConfirm={() => {}} />,
      ),
    );
    expect(footerButtons()[0]?.disabled).toBe(false);
    expect(footerButtons()[1]?.disabled).toBe(true);
  });
});
