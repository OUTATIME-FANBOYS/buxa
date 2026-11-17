import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@/logic/common';
import { Inbox } from '../Inbox';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

describe('Inbox', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, me: seed.users[0], actions: {} };
  });

  it('says nothing is waiting when no proposal needs a decision', () => {
    const html = renderToStaticMarkup(<UiProvider><Inbox proposals={[]} /></UiProvider>);
    expect(html).toContain('Nothing waiting for you');
  });
});
