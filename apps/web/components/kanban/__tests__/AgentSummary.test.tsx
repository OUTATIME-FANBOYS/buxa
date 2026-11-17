import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { AgentSummary } from '../AgentSummary';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));

describe('AgentSummary', () => {
  beforeEach(() => {
    const s = buildSeed();
    h.store = { s, workspace: s.workspaces[0] };
  });

  it('renders nothing when agents are switched off', () => {
    const s = buildSeed();
    h.store = { s: { ...s, ui: { ...s.ui, agentsEnabled: false } }, workspace: s.workspaces[0] };
    expect(renderToStaticMarkup(<AgentSummary />)).toBe('');
  });
  it('renders nothing for a workspace with no agent', () => {
    const s = buildSeed();
    h.store = { s: { ...s, agents: [] }, workspace: s.workspaces[0] };
    expect(renderToStaticMarkup(<AgentSummary />)).toBe('');
  });
  it('says there is no activity yet when the agent has not acted', () => {
    const html = renderToStaticMarkup(<AgentSummary />);
    expect(html).toContain('Agent work');
    expect(html).toContain('No agent activity yet.');
  });
});
