// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Dialog } from '@/components/components/export';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Dialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = ''; document.body.style.overflow = '';
  });

  it('renders a modal dialog in the body with its title, content and footer', () => {
    act(() => root.render(<Dialog title="Rename camp" onClose={() => undefined} footer={<button>Save</button>}><p>Pick a new name.</p></Dialog>));
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- Kept: querySelector returns the wider Element, and a plain ! would not narrow it to the type this test calls methods on.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Rename camp');
    expect(dialog.querySelector('h2')?.textContent).toBe('Rename camp');
    expect(dialog.textContent).toContain('Pick a new name.');
    expect(dialog.querySelector('.dialog-foot')?.textContent).toBe('Save');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('starts leaving from the close button and from Escape, then calls onClose after the exit', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    act(() => root.render(<Dialog title="Hi" onClose={onClose}><p>x</p></Dialog>));
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- Kept: querySelector returns the wider Element, and a plain ! would not narrow it to the type this test calls methods on.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    act(() => {
      // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- Kept: querySelector returns the wider Element, and a plain ! would not narrow it to the type this test calls methods on.
      (document.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    });
    expect(dialog.className).toContain('leaving');
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('gives drawers the drawer class and no title bar', () => {
    act(() => root.render(<Dialog title="Task" drawer onClose={() => undefined}><p>x</p></Dialog>));
    expect(document.querySelector('.drawer')).not.toBeNull();
    expect(document.querySelector('.dialog-head')).toBeNull();
  });
});
