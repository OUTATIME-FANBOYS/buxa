// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGlobalShortcuts } from '../useGlobalShortcuts';

const h = vi.hoisted(() => ({ openTask: vi.fn() }));
vi.mock('../../providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: h.openTask }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const press = (key: string, init: KeyboardEventInit = {}) => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
};

describe('useGlobalShortcuts', () => {
  let root: Root;
  let search: HTMLInputElement;
  beforeEach(() => {
    vi.clearAllMocks();
    search = document.body.appendChild(document.createElement('input'));
    const ref = createRef<HTMLInputElement>();
    ref.current = search;
    const Probe = ({ hasProject }: { hasProject: boolean }) => {
      useGlobalShortcuts(ref, hasProject);

      return null;
    };
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<Probe hasProject />));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('focuses search with ⌘K and with /', () => {
    press('k', { metaKey: true });
    expect(document.activeElement).toBe(search);
    search.blur();
    press('/');
    expect(document.activeElement).toBe(search);
  });
  it('starts a new task with c when a project exists', () => {
    press('c');
    expect(h.openTask).toHaveBeenCalledWith('new');
  });
  it('ignores bare keys while typing', () => {
    const field = document.body.appendChild(document.createElement('textarea'));
    field.focus();
    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    });
    expect(h.openTask).not.toHaveBeenCalled();
  });
});
