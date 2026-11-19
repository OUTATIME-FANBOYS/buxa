// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { ArchivedCampsCard } from '@/components/components/camp';
import type { ArchivedCamp } from '@/actions/camp';

const h = vi.hoisted(() => ({
  unarchiveCamp: vi.fn(),
  deleteCamp: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/camp', () => ({ unarchiveCamp: h.unarchiveCamp, deleteCamp: h.deleteCamp }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OWNED: ArchivedCamp = { id: 'o-1', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'owner' };
const SHARED: ArchivedCamp = { id: 'o-2', name: 'Camp Birch', archivedAt: '2026-10-03T09:00:00.000Z', role: 'admin' };

const button = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === text);
/** Buttons inside the open dialog only, since the row buttons have the same names. */
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

describe('the archived camps list', () => {
  let root: Root;

  const render = (camps: readonly ArchivedCamp[]) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <ArchivedCampsCard camps={camps} />
        </UiProvider>,
      ),
    );

  beforeEach(() => {
    h.unarchiveCamp.mockReset().mockResolvedValue({ ok: true });
    h.deleteCamp.mockReset().mockResolvedValue({ ok: true });
    h.push.mockReset();
    h.refresh.mockReset();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows Unarchive and Delete camp to the owner only', () => {
    render([OWNED, SHARED]);
    const rows = Array.from(document.querySelectorAll('.archived-list li'));

    expect(rows[0].textContent).toContain('Unarchive camp');
    expect(rows[0].textContent).toContain('Delete camp');
    expect(rows[1].textContent).not.toContain('Unarchive camp');
    expect(rows[1].textContent).not.toContain('Delete camp');
    expect(rows[1].textContent).toContain('Camp Birch');
  });

  it('gives the Unarchive and Delete buttons their icons', () => {
    render([OWNED]);

    expect(button('Unarchive camp')?.querySelector('svg[class*="lucide-archive-restore"]')).not.toBeNull();
    expect(button('Delete camp')?.querySelector('svg[class*="lucide-trash"]')).not.toBeNull();
  });

  it('unarchives after one confirm, calling unarchiveCamp with the camp id, then refreshes', async () => {
    render([OWNED]);

    act(() => button('Unarchive camp')?.click());
    expect(dialogText()).toContain('Camp Cedar becomes an active camp again');
    await act(async () => {
      dlg('Unarchive camp')?.click();
    });

    expect(h.unarchiveCamp).toHaveBeenCalledTimes(1);
    expect(h.unarchiveCamp).toHaveBeenCalledWith({ orgId: 'o-1' });
    expect(h.refresh).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the server message when unarchive is refused, and keeps the dialog open', async () => {
    h.unarchiveCamp.mockResolvedValue({ ok: false, message: 'This camp is not archived' });
    render([OWNED]);

    act(() => button('Unarchive camp')?.click());
    await act(async () => {
      dlg('Unarchive camp')?.click();
    });

    expect(document.querySelector('[role="alert"]')?.textContent).toBe('This camp is not archived');
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('deletes an archived camp only after "Are you sure?" and the exact name', async () => {
    render([OWNED]);

    act(() => button('Delete camp')?.click());
    expect(dialogText()).toContain('Are you sure you want to delete Camp Cedar?');
    act(() => dlg('Continue')?.click());

    act(() => typeInto(field()!, 'camp cedar'));
    expect(dlg('Delete camp')?.disabled).toBe(true);

    act(() => typeInto(field()!, 'Camp Cedar'));
    expect(dlg('Delete camp')?.disabled).toBe(false);

    await act(async () => {
      dlg('Delete camp')?.click();
    });
    expect(h.deleteCamp).toHaveBeenCalledWith({ orgId: 'o-1', confirmName: 'Camp Cedar' });
    expect(h.refresh).toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('says so when no camp is archived', () => {
    render([]);

    expect(document.querySelector('#archived-camps')?.textContent).toContain('No archived camps.');
  });
});
