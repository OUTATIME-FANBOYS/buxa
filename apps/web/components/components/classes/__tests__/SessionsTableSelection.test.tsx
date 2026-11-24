// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@buxa/contracts';
import type { SessionDeletion } from '@buxa/shared';
import { SessionsTable } from '@/components/components/classes';
import { UiProvider } from '@buxa/middleware/providers/providers';
import type { ReactNode } from 'react';

const NoDialog = () => null;
const withUi = (node: ReactNode) => <UiProvider Dialog={NoDialog}>{node}</UiProvider>;

const h = vi.hoisted(() => ({ deleteSessionAction: vi.fn(), deleteSessionsAction: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

vi.mock('@/actions/classes', () => ({
  updateSessionAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  deleteSessionsAction: h.deleteSessionsAction,
  setSessionArchivedAction: vi.fn(),
  publishSessionAction: vi.fn(),
  sessionDeleteImpactAction: vi.fn(),
  deleteSessionWithClassesAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ART = '11111111-1111-4111-8111-111111111111';
const MUSIC = '22222222-2222-4222-8222-222222222222';
const session = (id: string, name: string): Session => ({
  id,
  name,
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 0,
  isPublic: false,
  status: 'live',
  archivedAt: null,
  createdAt: '2027-07-01T00:00:00.000Z',
});
const SESSIONS = [session(ART, 'Art'), session(MUSIC, 'Music')];

const buttonWith = (text: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text) ?? null;
const checkboxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));

describe('SessionsTable: selection and bulk delete', () => {
  let root: Root;
  beforeEach(() => {
    h.deleteSessionsAction.mockReset();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('select-all ticks every row and the count follows', () => {
    act(() => root.render(withUi(<SessionsTable sessions={SESSIONS} canManage />)));
    const selectAll = document.querySelector<HTMLInputElement>('thead input[type="checkbox"]');
    act(() => selectAll?.click());
    expect(checkboxes().every(box => box.checked)).toBe(true);
    expect(document.body.textContent).toContain('2 selected');
    act(() => selectAll?.click());
    expect(document.body.textContent).not.toContain('selected');
  });

  it('one row checkbox updates the count', () => {
    act(() => root.render(withUi(<SessionsTable sessions={SESSIONS} canManage />)));
    act(() => checkboxes()[0]?.click());
    expect(document.body.textContent).toContain('1 selected');
  });

  it('sends the selected ids to the bulk action, then shows what was deleted and what was refused', async () => {
    const result: SessionDeletion = {
      status: 'done',
      deleted: [{ id: MUSIC, name: 'Music' }],
      refused: [
        {
          id: ART,
          name: 'Art',
          code: 'session_has_classes',
          reason:
            'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
        },
      ],
    };
    h.deleteSessionsAction.mockResolvedValue(result);
    act(() => root.render(withUi(<SessionsTable sessions={SESSIONS} canManage />)));
    act(() => document.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.click());

    const bar = buttonWith('Delete selected');
    act(() => bar?.click());
    expect(document.body.textContent).toContain('Delete 2 sessions?');

    const submit = document.querySelector<HTMLButtonElement>('button[type="submit"][form="delete-sessions-form"]');
    expect(submit).not.toBeNull();
    await act(async () => {
      submit?.click();
      await Promise.resolve();
    });

    expect(h.deleteSessionsAction).toHaveBeenCalledTimes(1);
    const form = h.deleteSessionsAction.mock.calls[0]?.[1] as FormData;
    expect(form.getAll('sessionId')).toEqual([ART, MUSIC]);

    expect(document.body.textContent).toContain('Deleted 1 session.');
    expect(document.body.textContent).toContain('Not deleted: Art (has classes; archive it instead).');
  });
});

describe('SessionsTable: the row trash', () => {
  let root: Root;
  beforeEach(() => {
    h.deleteSessionsAction.mockReset();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('deletes only its own row, even when other rows are selected', async () => {
    h.deleteSessionsAction.mockResolvedValue({ status: 'done', deleted: [{ id: MUSIC, name: 'Music' }], refused: [] });
    act(() => root.render(withUi(<SessionsTable sessions={SESSIONS} canManage />)));
    act(() => checkboxes()[0]?.click());
    expect(document.body.textContent).toContain('1 selected');

    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="Delete Music"]')?.click());
    expect(document.body.textContent).toContain('Delete session?');
    const submit = document.querySelector<HTMLButtonElement>('button[type="submit"][form="delete-sessions-form"]');
    await act(async () => {
      submit?.click();
      await Promise.resolve();
    });

    const form = h.deleteSessionsAction.mock.calls[0]?.[1] as FormData;
    expect(form.getAll('sessionId')).toEqual([MUSIC]);
  });

  it('opens archive-or-delete for a session with classes, not the plain confirmation', () => {
    const withClasses = [{ ...session(ART, 'Art'), classCount: 2 }];
    act(() => root.render(withUi(<SessionsTable sessions={withClasses} canManage />)));
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="Delete Art"]')?.click());

    expect(document.body.textContent).toContain(
      'Art has 2 classes. Archive the session, or delete its classes and the session.',
    );
    expect(document.body.textContent).not.toContain('Delete session?');
    expect(buttonWith('Archive session')).not.toBeNull();
  });

  it('shows an Archived pill on an archived session', () => {
    const archived = [{ ...session(ART, 'Art'), status: 'archived' as const, archivedAt: '2027-06-01T00:00:00.000Z' }];
    act(() => root.render(withUi(<SessionsTable sessions={archived} canManage />)));
    expect(document.body.textContent).toContain('Archived');
  });
});
