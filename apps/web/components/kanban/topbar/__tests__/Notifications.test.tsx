import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { Notifications } from '../Notifications';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));
vi.mock('@/components/kanban/state/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

describe('Notifications', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, me: null, wsTasks: seed.tasks, kindOf: () => 'open', actions: { markAllRead() {}, markNoticeRead() {} } };
  });

  it('is a bell labelled Notifications, with no count when nothing needs attention', () => {
    const html = renderToStaticMarkup(<Notifications />);
    expect(html).toContain('aria-label="Notifications"');
    expect(html).not.toContain('class="badge"');
  });
  it('counts unread notices for the signed-in person on the bell', () => {
    const seed = buildSeed();
    const me = seed.users[0];
    const notices = [{ id: 'n-1', userId: me.id, read: false, kind: 'comment', text: 'New comment' }, { id: 'n-2', userId: me.id, read: false, kind: 'invite', text: 'Invite' }];
    h.store = { ...h.store, s: { ...seed, notices }, me, wsTasks: [] };
    const html = renderToStaticMarkup(<Notifications />);
    expect(html).toContain('2 need attention');
    expect(html).toContain('<span class="badge">2</span>');
  });
});
