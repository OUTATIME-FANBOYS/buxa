import { Dialog as ConfirmDialog } from '@/components/components/export';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { History } from '@/components/components/kanban/agents/export';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

describe('History', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, me: seed.users[0], actions: {} };
  });

  it('is the audit trail: filterable by outcome and agent, with an export', () => {
    const seed = buildSeed();
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><History proposals={[]} agents={seed.agents} /></UiProvider>);
    expect(html).toContain('aria-label="Filter by outcome"');
    expect(html).toContain('>All outcomes</option>');
    expect(html).toContain('Export audit log');
  });
});
