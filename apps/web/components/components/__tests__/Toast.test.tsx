// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toast, TOAST_MS } from '@/components/components/Toast';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Toast', () => {
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('shows the message as a polite status, not a modal', () => {
    act(() => root.render(<Toast message={'Deleted "Art".'} />));
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Deleted "Art".');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has a labelled close button that removes the toast when clicked', () => {
    act(() => root.render(<Toast message="Profile saved" />));
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]');
    expect(close).not.toBeNull();
    act(() => close?.click());
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('closes itself after 4 seconds', () => {
    expect(TOAST_MS).toBe(4000);
    act(() => root.render(<Toast message="Deleted 1 session." />));
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector('[role="status"]')).toBeNull();
  });
});
