import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { History } from '../History';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

describe('History', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, me: seed.users[0], actions: {} };
  });

  it('is the audit trail: filterable by outcome and agent, with an export', () => {
    const seed = buildSeed();
    const html = renderToStaticMarkup(<UiProvider><History proposals={[]} agents={seed.agents} /></UiProvider>);
    expect(html).toContain('aria-label="Filter by outcome"');
    expect(html).toContain('>All outcomes</option>');
    expect(html).toContain('Export audit log');
  });
});
