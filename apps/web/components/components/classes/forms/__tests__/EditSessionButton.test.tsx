// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { Session } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { EditSessionButton } from '../EditSessionButton';

vi.mock('@/actions/classes', () => ({
  updateSessionAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  setSessionArchivedAction: vi.fn(),
  publishSessionAction: vi.fn(),
  sessionDeleteImpactAction: vi.fn(),
  deleteSessionWithClassesAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NoDialog = () => null;
const withUi = (node: ReactNode) => <UiProvider Dialog={NoDialog}>{node}</UiProvider>;

const session = (over: Partial<Session> = {}): Session => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 0,
  isPublic: false,
  status: 'draft',
  archivedAt: null,
  createdAt: '2027-07-01T00:00:00.000Z',
  ...over,
});

const buttonWith = (text: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text) ?? null;

describe('EditSessionButton: the session status', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const open = (node: ReactNode) => {
    act(() => root.render(withUi(node)));
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label^="Edit"]')?.click());
  };

  it('offers Go live on a draft to an admin or the owner, and says registration is closed', () => {
    open(<EditSessionButton session={session()} canPublish />);
    expect(buttonWith('Go live')).not.toBeNull();
    expect(document.body.textContent).toContain('This session is a draft');
    expect(document.querySelector('input[name="sessionId"]')).not.toBeNull();
  });

  it('does not offer Go live without classes:publish, nor on a live session', () => {
    open(<EditSessionButton session={session()} />);
    expect(buttonWith('Go live')).toBeNull();
    act(() => root.unmount());
    root = createRoot(document.body.appendChild(document.createElement('div')));
    open(<EditSessionButton session={session({ status: 'live' })} canPublish />);
    expect(buttonWith('Go live')).toBeNull();
    expect(document.body.textContent).toContain('This session is live');
  });

  it('offers Unarchive only on an archived session, and only with org:update', () => {
    const archived = session({ status: 'archived', archivedAt: '2027-06-01T00:00:00.000Z' });
    open(<EditSessionButton session={archived} canUnarchive />);
    expect(buttonWith('Unarchive session')).not.toBeNull();
    expect(buttonWith('Go live')).toBeNull();
  });

  it('never offers Delete in the pop-up: deleting is the sessions table trash icon', () => {
    open(<EditSessionButton session={session()} />);
    expect(buttonWith('Delete session')).toBeNull();
    expect(buttonWith('Delete classes and session')).toBeNull();
  });

  it('puts Unarchive in the footer on the left, before Cancel and Save', () => {
    open(
      <EditSessionButton
        session={session({ status: 'archived', archivedAt: '2027-06-01T00:00:00.000Z' })}
        canUnarchive
      />,
    );
    const unarchive = buttonWith('Unarchive session');
    const cancel = buttonWith('Cancel');
    const save = buttonWith('Save session');
    if (!unarchive || !cancel || !save) {
      throw new Error('the footer should hold Unarchive, Cancel and Save');
    }
    expect(unarchive.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
