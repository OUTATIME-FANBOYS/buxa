import { Dialog as ConfirmDialog } from '@/components/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildDemo } from '@buxa/shared';
import { type Proposal } from '@buxa/shared';
import { ProposalRow } from '@/components/components/kanban/agents';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));

const demo = buildDemo();
const proposal = demo.proposals[0] ?? demo.proposals[0];

describe('ProposalRow', () => {
  beforeEach(() => {
    h.store = { s: demo, actions: { decide: vi.fn() } };
  });

  it('shows a waiting proposal with approve and reject for someone who can decide', () => {
    const pending = { ...proposal, status: 'pending' } as Proposal;
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <ProposalRow p={pending} actions />
      </UiProvider>,
    );
    expect(html).toContain(`class="prop prop-pending"`);
    expect(html).toMatch(/aria-label="Approve: /);
    expect(html).toMatch(/aria-label="Reject: /);
  });
  it('shows a decided proposal as its outcome in words, with no decision buttons', () => {
    const decided = { ...proposal, status: 'approved' } as Proposal;
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <ProposalRow p={decided} actions={false} />
      </UiProvider>,
    );
    expect(html).toContain('Approved');
    expect(html).not.toContain('aria-label="Approve: ');
  });
});
