import { Dialog as ConfirmDialog } from '@/components/components/export';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ArchivePersonButton } from '@/components/components/people/forms/export';

const h = vi.hoisted(() => ({ archivePersonAction: vi.fn() }));
vi.mock('@buxa/server/composers/people/archivePersonAction', () => ({ archivePersonAction: h.archivePersonAction }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ArchivePersonButton', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks(); root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('asks for confirmation before archiving, and does nothing when the person says no', async () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ArchivePersonButton personId="p-1" personName="Ada Lee" /></UiProvider>));
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Archive person') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Archive Ada Lee?');
    const cancel = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel') as HTMLButtonElement;
    await act(async () => {
      cancel.click();
    });
    expect(h.archivePersonAction).not.toHaveBeenCalled();
  });

  it('archives once confirmed', async () => {
    h.archivePersonAction.mockResolvedValueOnce({ status: 'success' });
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ArchivePersonButton personId="p-1" personName="Ada Lee" /></UiProvider>));
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Archive person') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    const confirm = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent === 'Archive') as HTMLButtonElement;
    await act(async () => {
      confirm.click();
    });
    expect(h.archivePersonAction).toHaveBeenCalledWith('p-1');
  });
});
