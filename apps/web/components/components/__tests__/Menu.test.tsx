// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Menu } from '@/components/components/export';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Menu', () => {
  let root: Root;
  beforeEach(() => { root = createRoot(document.body.appendChild(document.createElement('div'))); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts closed with its label on the trigger', () => {
    act(() => root.render(<Menu label="Task actions" trigger="⋯" items={[{ label: 'Rename', onSelect: () => undefined }]} />));
    const trigger = document.querySelector('button[aria-label="Task actions"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('opens on click, lists the items, and runs the chosen one', () => {
    const onRename = vi.fn();
    act(() => root.render(<Menu label="Task actions" trigger="⋯" items={[{ label: 'Rename', onSelect: onRename }, false, { label: 'Delete', danger: true, onSelect: () => undefined }]} />));
    const trigger = document.querySelector('button[aria-label="Task actions"]') as HTMLButtonElement;
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map((i) => i.textContent)).toEqual(['Rename', 'Delete']);
    expect(items[1].className).toBe('danger');
    act(() => items[0].click());
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
