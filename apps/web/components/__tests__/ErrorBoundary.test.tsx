// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from '../ErrorBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Broken(): never { throw new Error('board exploded'); }

describe('ErrorBoundary', () => {
  let root: Root;
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('renders its children when nothing goes wrong', () => {
    act(() => root.render(<ErrorBoundary><p>board</p></ErrorBoundary>));
    expect(document.body.textContent).toContain('board');
  });
  it('shows a recovery message with the error text when a child throws', () => {
    act(() => root.render(<ErrorBoundary><Broken /></ErrorBoundary>));
    expect(document.querySelector('.fatal')?.textContent).toContain('Something went wrong');
    expect(document.querySelector('.fatal pre')?.textContent).toBe('board exploded');
    expect(Array.from(document.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Reload', 'Back to dashboard']);
  });
});
