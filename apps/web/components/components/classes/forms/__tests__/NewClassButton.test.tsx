// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { failure } from '@buxa/shared';
import { NewClassButton } from '@/components/components/classes/forms/export';

const createClass = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/classes/createClassAction', () => ({ createClassAction: createClass }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The dialog's exit runs for 190ms before it unmounts; wait past it.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 250)); });
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('NewClassButton (the Classes page)', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    createClass.mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  const button = () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'New class') as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const open = async () => { button().focus(); act(() => button().click()); await flush(); };

  it('opens the create form in a dialog from the New class button', async () => {
    act(() => root.render(<NewClassButton />));
    expect(dialog()).toBeNull();
    await open();
    expect(dialog()?.getAttribute('aria-label')).toBe('New class');
    expect(dialog()?.querySelector('form.class-form input[name="name"]')).not.toBeNull();
    expect(dialog()?.textContent).toContain('Instructor ratio (optional)');
    expect(dialog()?.querySelector('button[type="submit"]')?.textContent).toBe('Create class');
  });

  it('closes on Escape, returns focus to the button, and leaves no dialog behind', async () => {
    act(() => root.render(<NewClassButton />));
    await open();
    act(() => dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await settle();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes from its Cancel button', async () => {
    act(() => root.render(<NewClassButton />));
    await open();
    const cancel = Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent === 'Cancel') as HTMLButtonElement;
    act(() => cancel.click());
    await settle();
    expect(dialog()).toBeNull();
  });

  it('shows the validation messages from the action, and focuses the first field with a problem', async () => {
    createClass.mockResolvedValue(failure('Check the highlighted fields.', { name: 'Enter a class name.', capacity: 'Enter the default places.' }));
    act(() => root.render(<NewClassButton />));
    await open();
    const form = dialog()!.querySelector('form') as HTMLFormElement;
    act(() => form.requestSubmit());
    await flush();
    expect(createClass).toHaveBeenCalledTimes(1);
    expect(dialog()!.textContent).toContain('Enter a class name.');
    expect(dialog()!.textContent).toContain('Enter the default places.');
    expect(document.activeElement).toBe(dialog()!.querySelector('input[name="name"]'));
  });

  it('submits the fields as typed', async () => {
    createClass.mockResolvedValue(failure('Check the highlighted fields.', {}));
    act(() => root.render(<NewClassButton />));
    await open();
    dialog()!.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Robotics';
    dialog()!.querySelector<HTMLInputElement>('input[name="minAge"]')!.value = '8';
    act(() => (dialog()!.querySelector('form') as HTMLFormElement).requestSubmit());
    await flush();
    const data = createClass.mock.calls[0]?.[1] as FormData;
    expect(data.get('name')).toBe('Robotics');
    expect(data.get('minAge')).toBe('8');
  });
});
