// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@/providers/providers';
import { RenameCampDialog } from '../RenameCampDialog';

vi.mock('@/logic/composers/camp/renameCampAction', () => ({ renameCampAction: async () => ({ status: 'idle' }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RenameCampDialog', () => {
  let root: Root;
  beforeEach(() => { root = createRoot(document.body.appendChild(document.createElement('div'))); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('opens with the current name in the field and the camp id carried in the form', () => {
    const onClose = vi.fn();
    act(() => root.render(<UiProvider><RenameCampDialog campId="o-1" currentName="Camp Birchwood" onClose={onClose} /></UiProvider>));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Rename camp');
    const input = dialog.querySelector<HTMLInputElement>('input[name="name"]')!;
    expect(input.value).toBe('Camp Birchwood');
    expect(dialog.querySelector<HTMLInputElement>('input[name="campId"]')!.value).toBe('o-1');
    const cancel = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel') as HTMLButtonElement;
    act(() => cancel.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
