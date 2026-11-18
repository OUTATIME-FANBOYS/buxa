import { Dialog as ConfirmDialog } from '@/components/components/export';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { RenameCampDialog } from '@/components/components/camp/export';
import { settle, requirePresent } from '@buxa/domain';

vi.mock('@buxa/server/composers/camp/renameCampAction', () => ({ renameCampAction: () => settle(() => ({ status: 'idle' })) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RenameCampDialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('opens with the current name in the field and the camp id carried in the form', () => {
    const onClose = vi.fn();
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><RenameCampDialog campId="o-1" currentName="Camp Birchwood" onClose={onClose} /></UiProvider>));
    const dialog = requirePresent(document.querySelector('[role="dialog"]'), "document.querySelector('[role=\"dialog\"]')");
    expect(dialog.getAttribute('aria-label')).toBe('Rename camp');
    const input = requirePresent(dialog.querySelector<HTMLInputElement>('input[name="name"]'), "dialog.querySelector<HTMLInputElement>('input[name=\"name\"]')");
    expect(input.value).toBe('Camp Birchwood');
    expect(requirePresent(dialog.querySelector<HTMLInputElement>('input[name="campId"]'), "dialog.querySelector<HTMLInputElement>('input[name=\"campId\"]')").value).toBe('o-1');
    const cancel = requirePresent(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel'), "Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')");
    act(() => cancel.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
