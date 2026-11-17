import { describe, expect, it } from 'vitest';
import { agentActions } from '../agents';
import { AGENT_ID, PROJECT } from '../../../../common';
import { buildSeed } from '../../../../common';
import { fakeContext } from './fakeContext';

describe('agent actions', () => {
  it('switches the agents on and off in the ui state', () => {
    const ctx = fakeContext(buildSeed());
    agentActions(ctx).setAgentsEnabled(false);
    expect(ctx.get().ui.agentsEnabled).toBe(false);
  });
  it('adds an agent to a workspace', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    agentActions(ctx).addAgent(seed.workspaces[0].id, 'Scout', 'Claude', 'Finds gaps', [PROJECT.registration]);
    expect(ctx.get().users.length).toBe(seed.users.length + 1);
    expect(ctx.get().agents.length).toBe(seed.agents.length + 1);
  });
  it('runs the seeded agent over a project and reports how many proposals it made', () => {
    const ctx = fakeContext(buildSeed());
    const count = agentActions(ctx).simulateRun(AGENT_ID, PROJECT.registration);
    expect(count).toBeGreaterThanOrEqual(0);
    expect(typeof count).toBe('number');
  });
  it('reverts nothing for a run that does not exist', () => {
    const ctx = fakeContext(buildSeed());
    expect(agentActions(ctx).revertRun('run-missing')).toEqual({ reverted: 0, skipped: 0 });
  });
});
