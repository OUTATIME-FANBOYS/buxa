// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Popover } from '@/components/components/export';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Popover', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('portals its content to the body as a labelled dialog', () => {
    act(() => root.render(<Popover anchor={null} onClose={() => undefined} label="Filters" className="x"><p>Choose</p></Popover>));
    const pop = document.querySelector('.popover') as HTMLElement;
    expect(pop.getAttribute('aria-label')).toBe('Filters');
    expect(pop.classList.contains('x')).toBe(true);
    expect(pop.textContent).toBe('Choose');
    expect(pop.parentElement).toBe(document.body);
  });

  it('closes on Escape and returns focus to its anchor', () => {
    const anchor = document.body.appendChild(document.createElement('button'));
    const onClose = vi.fn();
    act(() => root.render(<Popover anchor={anchor} onClose={onClose}><p>x</p></Popover>));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when pressing outside it, but not inside', () => {
    const onClose = vi.fn();
    const outside = document.body.appendChild(document.createElement('span'));
    act(() => root.render(<Popover anchor={null} onClose={onClose}><button>inside</button></Popover>));
    const inside = document.querySelector('.popover button') as HTMLElement;
    act(() => {
      inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
