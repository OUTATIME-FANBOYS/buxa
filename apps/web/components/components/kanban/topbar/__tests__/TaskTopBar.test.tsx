import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskTopBar } from '@/components/components/kanban/topbar';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('@buxa/middleware/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));

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
  const html = renderToStaticMarkup(<TaskTopBar account={<span>me</span>} />);

  return html.match(/class="save-state[^"]*" role="status">([^<]*)</)?.[1] ?? '';
}

describe('TaskTopBar', () => {
  beforeEach(() => {
    h.store = {};
  });

  it('says what the save state is, in words', () => {
    expect(saveLabel('saved', 'synced')).toBe('Synced');
    expect(saveLabel('saving', 'local')).toBe('Saving…');
    expect(saveLabel('error', 'local')).toBe('Not saved, storage full');
    expect(saveLabel('saved', 'offline')).toBe('Offline, retrying');
  });
  it('places search, notifications and the account menu together', () => {
    saveLabel('saved', 'synced');
    const html = renderToStaticMarkup(<TaskTopBar account={<span>account-menu</span>} />);
    expect(html).toContain('aria-label="Search all tasks"');
    expect(html).toContain('aria-label="Notifications"');
    expect(html).toContain('account-menu');
  });
});
