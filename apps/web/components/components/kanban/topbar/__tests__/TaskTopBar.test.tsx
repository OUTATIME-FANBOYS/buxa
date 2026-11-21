import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskTopBar } from '@/components/components/kanban/topbar';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock('@/actions/notifications', () => ({ markNotificationsRead: () => Promise.resolve() }));

const seed = buildSeed();

function saveLabel(saveStatus: string, sync: string): string {
  h.store = {
    s: seed,
    wsTasks: [],
    saveStatus,
    sync,
    project: seed.projects[0],
    userById: () => undefined,
    kindOf: () => 'open',
    me: null,
    actions: {},
  };
  const html = renderToStaticMarkup(<TaskTopBar account={<span>me</span>} items={[]} unread={0} />);

  return html.match(/class="save-state[^"]*" role="status">([^<]*)</)?.[1] ?? '';
}

describe('TaskTopBar', () => {
  beforeEach(() => {
    h.store = {};
  });

  it('says what the save state is, in words, while something is unsaved or syncing', () => {
    expect(saveLabel('saving', 'synced')).toBe('Syncing…');
    expect(saveLabel('saving', 'local')).toBe('Saving…');
    expect(saveLabel('error', 'local')).toBe('Not saved, storage full');
    expect(saveLabel('saved', 'offline')).toBe('Offline, retrying');
  });
  it('shows no save note when everything is saved, so the header never says Saved', () => {
    expect(saveLabel('saved', 'synced')).toBe('');
    expect(saveLabel('saved', 'local')).toBe('');
    const html = renderToStaticMarkup(<TaskTopBar account={<span>account-menu</span>} items={[]} unread={0} />);
    expect(html).not.toContain('Saved');
    expect(html).not.toContain('save-state');
  });
  it('places Help, notifications and the account menu in that order, with no search control', () => {
    saveLabel('saved', 'synced');
    const html = renderToStaticMarkup(<TaskTopBar account={<span>account-menu</span>} items={[]} unread={0} />);
    const at = (s: string) => html.indexOf(s);
    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('aria-label="Notifications"');
    expect(html).not.toContain('Search all tasks');
    expect(at('aria-label="Help"')).toBeLessThan(at('aria-label="Notifications"'));
    expect(at('aria-label="Notifications"')).toBeLessThan(at('account-menu'));
  });
});
