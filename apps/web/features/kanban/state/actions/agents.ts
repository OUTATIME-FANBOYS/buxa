import type { ProposalKind, Trust } from '../../types';
import * as Ag from '../../lib/agents';
import { simulateRun } from '../../lib/agentSim';
import type { ActionContext } from './context';

export function agentActions({ set, get }: ActionContext) {
  return {
    setAgentsEnabled: (on: boolean) => set(s => ({ ...s, ui: { ...s.ui, agentsEnabled: on } })),
    addAgent: (workspaceId: string, name: string, model: string, purpose: string, scope: string[]) => set(s => Ag.addAgent(s, workspaceId, name, model, purpose, scope)),
    updateAgent: (id: string, patch: Parameters<typeof Ag.updateAgent>[2]) => set(s => Ag.updateAgent(s, id, patch)),
    setTrust: (id: string, kind: Parameters<typeof Ag.setTrust>[2], level: Parameters<typeof Ag.setTrust>[3]) => set(s => Ag.setTrust(s, id, kind, level)),
    setMoveRule: (id: string, columnId: string, level: Trust | null) => set(s => Ag.setMoveRule(s, id, columnId, level)),
    setApproves: (id: string, kinds: ProposalKind[]) => set(s => Ag.setApproves(s, id, kinds)),
    decide: (proposalId: string, verdict: 'approve' | 'reject') => set(s => Ag.decide(s, proposalId, verdict)),
    decideMany: (ids: string[], verdict: 'approve' | 'reject') => set(s => Ag.decideMany(s, ids, verdict)),
    revertRun(runId: string): { reverted: number; skipped: number } {
      const r = Ag.revertRun(get(), runId); set(s => Ag.revertRun(s, runId).state); return { reverted: r.reverted, skipped: r.skipped };
    },
    simulateRun(agentId: string, projectId: string): number {
      const r = simulateRun(get(), agentId, projectId); if (r.count) set(s => simulateRun(s, agentId, projectId).state); return r.count;
    },
  };
}
