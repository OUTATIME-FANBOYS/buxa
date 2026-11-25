import { ConfirmDialog } from '@/components/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { Inbox } from '@/components/components/kanban/agents';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));

describe('Inbox', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, me: seed.users[0], actions: {} };
  });

  it('says nothing is waiting when no proposal needs a decision', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Inbox proposals={[]} />
      </UiProvider>,
    );
    expect(html).toContain('Nothing waiting for you');
  });
});
