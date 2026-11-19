import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { type Agent } from '@buxa/shared';
import { AgentCard } from '@/components/components/kanban/agents';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/components/components/kanban/dialogs/ConnectAgentDialog', () => ({ ConnectAgentDialog: () => null }));

describe('AgentCard', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, actions: { updateAgent: vi.fn() }, projects: seed.projects, sync: 'local' };
  });

  it('shows the agent with its model, its purpose and whether it is active', () => {
    const agent = buildSeed().agents[0];
    const html = renderToStaticMarkup(<AgentCard agent={agent} canManage={false} />);
    expect(html).toContain('agent-card');
    expect(html).toContain(agent.model);
    expect(html).toContain('>Active</span>');
    expect(html).toContain('Accepted');
  });
  it('shows a paused agent as paused', () => {
    const agent = { ...buildSeed().agents[0], paused: true } as Agent;
    expect(renderToStaticMarkup(<AgentCard agent={agent} canManage={false} />)).toContain('>Paused</span>');
  });
});
