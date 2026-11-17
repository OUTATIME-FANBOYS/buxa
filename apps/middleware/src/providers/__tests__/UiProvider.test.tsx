// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType } from 'react';
import { UiProvider, useUi, type ConfirmDialogProps } from '../UiProvider';

// A stand-in for the web app's Dialog: the same role and label, so the confirm prompt can be tested here.
const Dialog: ComponentType<ConfirmDialogProps> = ({ title, footer, children }) => (
  <div role="dialog" aria-label={title}>{children}{footer}</div>
);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useUi>;
let api: Api | undefined;
function Probe() {
  api = useUi();

  return null;
}

describe('UiProvider', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<UiProvider Dialog={Dialog}><Probe /><p>app</p></UiProvider>));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('shows a toast with its text in the status region', () => {
    act(() => api!.toast('Saved'));
    expect(document.querySelector('.toasts')?.getAttribute('role')).toBe('status');
    expect(document.querySelector('.toast')?.textContent).toBe('Saved');
  });
  it('marks error toasts', () => {
    act(() => api!.toast('Could not save', { tone: 'error' }));
    expect(document.querySelector('.toast-error')?.textContent).toBe('Could not save');
  });
  it('asks for confirmation and resolves true when confirmed', async () => {
    let answer: boolean | undefined;
    act(() => {
      void api!.confirm({ title: 'Delete task?', body: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then((b) => {
        answer = b;
      });
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Delete task?');
    expect(dialog.textContent).toContain('This cannot be undone.');
    const confirm = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete') as HTMLButtonElement;
    expect(confirm.className).toContain('btn-danger');
    await act(async () => {
      confirm.click();
    });
    expect(answer).toBe(true);
  });
  it('resolves false when cancelled', async () => {
    let answer: boolean | undefined;
    act(() => {
      void api!.confirm({ title: 'Leave?' }).then((b) => {
        answer = b;
      });
    });
    const cancel = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Cancel') as HTMLButtonElement;
    await act(async () => {
      cancel.click();
    });
    expect(answer).toBe(false);
  });
  it('tracks the small-screen sidebar state', () => {
    act(() => api!.setSidebarOpen(true));
    expect(api!.sidebarOpen).toBe(true);
  });
  it('throws a clear error when used outside the provider', () => {
    expect(() => {
      function Bare() {
        useUi();

        return null;
      } act(() => createRoot(document.createElement('div')).render(<Bare />));
    }).toThrow();
  });
});
