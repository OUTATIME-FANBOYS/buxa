// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { DangerZone } from '@/components/components/camp';

const h = vi.hoisted(() => ({
  archiveCamp: vi.fn(),
  deleteCamp: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/camp', () => ({ archiveCamp: h.archiveCamp, deleteCamp: h.deleteCamp }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) {
    throw new Error(`Expected ${what} on the page.`);
  }

  return value;
}

const NAME = 'Camp Birchwood';

const button = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === text);
/** Buttons inside the open dialog only: the danger zone has its own buttons with the same names. */
const dlg = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
    b => b.textContent?.trim() === text,
  );
const field = () => document.querySelector<HTMLInputElement>('input[name="confirmName"]');
/** React listens for the input event, so set the value through the native setter. */
const typeInto = (input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const dialogText = () => document.querySelector('[role="dialog"]')?.textContent ?? '';

describe('the danger zone', () => {
  let root: Root;
  const renderZone = (roles: { canArchive: boolean; canDelete: boolean }) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <DangerZone campId="o-1" campName={NAME} {...roles} />
        </UiProvider>,
      ),
    );

  beforeEach(() => {
    h.archiveCamp.mockReset().mockResolvedValue({ ok: true });
    h.deleteCamp.mockReset().mockResolvedValue({ ok: true });
    h.push.mockReset();
    h.refresh.mockReset();
    root = createRoot(document.body.appendChild(document.createElement('div')));
    renderZone({ canArchive: true, canDelete: true });
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows Archive camp and Delete camp to the owner', () => {
    expect(button('Archive camp')).toBeDefined();
    expect(button('Delete camp')).toBeDefined();
  });

  it('shows only Archive camp to an admin, who may archive but not delete', () => {
    act(() => root.unmount());
    root = createRoot(document.body.appendChild(document.createElement('div')));
    renderZone({ canArchive: true, canDelete: false });
    expect(button('Archive camp')).toBeDefined();
    expect(button('Delete camp')).toBeUndefined();
    expect(document.querySelector('.danger-zone')).not.toBeNull();
  });

  it('shows no buttons to a role that can neither archive nor delete', () => {
    act(() => root.unmount());
    root = createRoot(document.body.appendChild(document.createElement('div')));
    renderZone({ canArchive: false, canDelete: false });
    expect(document.querySelectorAll('.danger-zone button').length).toBe(0);
  });

  it('archives the camp after one confirm, calling archiveCamp with the camp id', async () => {
    act(() => button('Archive camp')?.click());
    expect(dialogText()).toContain('Archiving hides Camp Birchwood from your camp list');
    expect(dialogText()).toContain('kept');
    await act(() => {
      dlg('Archive camp')?.click();

      return Promise.resolve();
    });
    expect(h.archiveCamp).toHaveBeenCalledWith({ orgId: 'o-1' });
    expect(h.push).toHaveBeenCalledWith('/camp');
  });

  it('asks "Are you sure?" first, then keeps Delete disabled until the name is typed exactly', async () => {
    act(() => button('Delete camp')?.click());
    expect(dialogText()).toContain('Are you sure you want to delete Camp Birchwood?');
    act(() => dlg('Continue')?.click());
    expect(dlg('Delete camp')?.disabled).toBe(true);

    act(() => typeInto(must(field(), 'the name field'), 'camp birchwood'));
    expect(dlg('Delete camp')?.disabled).toBe(true);

    act(() => typeInto(must(field(), 'the name field'), 'Camp Birchwood '));
    expect(dlg('Delete camp')?.disabled).toBe(true);

    act(() => typeInto(must(field(), 'the name field'), NAME));
    expect(dlg('Delete camp')?.disabled).toBe(false);

    await act(() => {
      dlg('Delete camp')?.click();

      return Promise.resolve();
    });
    expect(h.deleteCamp).toHaveBeenCalledWith({ orgId: 'o-1', confirmName: NAME });
  });

  it('shows the server message when an action fails, and keeps the dialog open', async () => {
    h.archiveCamp.mockResolvedValue({ ok: false, message: 'Only the owner can archive this camp.' });
    act(() => button('Archive camp')?.click());
    await act(() => {
      dlg('Archive camp')?.click();

      return Promise.resolve();
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Only the owner can archive this camp.');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('gives Archive camp and Delete camp text only, with no icon', () => {
    expect(button('Archive camp')?.querySelector('svg')).toBeNull();
    expect(button('Delete camp')?.querySelector('svg')).toBeNull();
  });

  it('disables the buttons while the request runs', async () => {
    let finish: (v: { ok: true }) => void = () => undefined;
    h.archiveCamp.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    act(() => button('Archive camp')?.click());
    act(() => {
      dlg('Archive camp')?.click();
    });
    expect(dlg('Archiving…')?.disabled).toBe(true);
    expect(dlg('Cancel')?.disabled).toBe(true);
    await act(() => {
      finish({ ok: true });

      return Promise.resolve();
    });
  });
});
