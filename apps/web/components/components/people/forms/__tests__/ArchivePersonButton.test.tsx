import { ConfirmDialog } from '@/components/components';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ArchivePersonButton } from '@/components/components/people/forms';
import { settle, requirePresent } from '@buxa/domain';

const h = vi.hoisted(() => ({ archivePersonAction: vi.fn() }));
vi.mock('@buxa/server/composers/people/archivePersonAction', () => ({ archivePersonAction: h.archivePersonAction }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ArchivePersonButton', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('asks for confirmation before archiving, and does nothing when the person says no', async () => {
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <ArchivePersonButton personId="p-1" personName="Ada Lee" />
        </UiProvider>,
      ),
    );
    const button = requirePresent(
      Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Archive person'),
      "Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Archive person')",
    );
    await act(() => {
      return settle(() => {
        button.click();
      });
    });
    const dialog = requirePresent(
      document.querySelector('[role="dialog"]'),
      'document.querySelector(\'[role="dialog"]\')',
    );
    expect(dialog.getAttribute('aria-label')).toBe('Archive Ada Lee?');
    const cancel = requirePresent(
      Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Cancel'),
      "Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')",
    );
    await act(() => {
      return settle(() => {
        cancel.click();
      });
    });
    expect(h.archivePersonAction).not.toHaveBeenCalled();
  });

  it('archives once confirmed', async () => {
    h.archivePersonAction.mockResolvedValueOnce({ status: 'success' });
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <ArchivePersonButton personId="p-1" personName="Ada Lee" />
        </UiProvider>,
      ),
    );
    const button = requirePresent(
      Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Archive person'),
      "Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Archive person')",
    );
    await act(() => {
      return settle(() => {
        button.click();
      });
    });
    const confirm = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
      b => b.textContent === 'Archive',
    ) as HTMLButtonElement;
    await act(() => {
      return settle(() => {
        confirm.click();
      });
    });
    expect(h.archivePersonAction).toHaveBeenCalledWith('p-1');
  });
});
