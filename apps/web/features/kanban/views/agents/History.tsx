import { useState } from 'react';
import { Avatar, Empty, Icon, Menu, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import { ago } from '../../lib/dates';
import * as A from '../../lib/agents';
import type { Agent, Proposal, ProposalStatus } from '../../types';
import { groupByRun } from './groupByRun';
import { ProposalRow } from './ProposalRow';
import { STATUS_LABEL } from './labels';

/** The audit trail: every decided proposal, filterable, exportable, and revertible per run. */
export function History({ proposals, agents }: { proposals: Proposal[]; agents: Agent[] }) {
  const { s, me, actions } = useStore(); const { confirm, toast } = useUi();
  const [status, setStatus] = useState<'all' | ProposalStatus>('all'); const [agent, setAgent] = useState('all');
  const shown = proposals.filter(p => p.status !== 'pending' && (status === 'all' || p.status === status) && (agent === 'all' || p.agentId === agent));
  const groups = groupByRun(shown);
  const exportAudit = () => {
    const rows = proposals.map(p => ({ at: p.at, agent: s.users.find(u => u.id === p.agentId)?.name, run: s.runs.find(r => r.id === p.runId)?.label, action: A.describe(s, p.change).text, reason: p.reason, status: p.status, decidedBy: s.users.find(u => u.id === p.decidedBy)?.name, decidedAt: p.decidedAt, note: p.note }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `agent-audit-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="stack">
      <div className="row filters">
        <select aria-label="Filter by outcome" value={status} onChange={e => setStatus(e.target.value as 'all' | ProposalStatus)} className="inline-select">
          <option value="all">All outcomes</option>{(['applied', 'approved', 'rejected', 'blocked', 'reverted'] as ProposalStatus[]).map(x => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
        {agents.length > 1 && <select aria-label="Filter by agent" value={agent} onChange={e => setAgent(e.target.value)} className="inline-select"><option value="all">All agents</option>{agents.map(a => <option key={a.userId} value={a.userId}>{s.users.find(u => u.id === a.userId)?.name}</option>)}</select>}
        <span className="grow" /><button className="btn btn-sm" onClick={exportAudit} disabled={!proposals.length}><Icon name="download" size={15} />Export audit log</button>
      </div>
      {!groups.length ? <Empty icon="inbox" title="No history yet" body="Everything an agent does, and every decision you make, is recorded here." /> : (
        <div className="run-list">{groups.map(g => {
          const run = s.runs.find(r => r.id === g.runId); const agentId = g.items[0].agentId; const revertable = g.items.filter(p => (p.status === 'applied' || p.status === 'approved') && p.undo).length;
          return (
            <section key={g.runId} className="panel run">
              <div className="run-head">
                <Avatar user={s.users.find(u => u.id === agentId)} size={32} />
                <div className="grow"><strong>{run?.label ?? 'Agent run'}</strong><span className="muted small block">{s.users.find(u => u.id === agentId)?.name} · {ago(g.at)}{run?.simulated ? ' · simulated' : ''}{run?.costUsd ? ` · $${run.costUsd.toFixed(2)}` : ''}</span></div>
                {revertable > 0 && A.canDecide(s, me?.id, agentId) && <Menu label="Run actions" trigger={<Icon name="more" />} items={[{ label: `Revert ${revertable} change${revertable === 1 ? '' : 's'}`, icon: 'undo', danger: true, onSelect: async () => {
                  if (!await confirm({ title: 'Revert this run?', body: 'Its changes are undone where nobody has worked on them since. Anything a person has touched is left as it is.', confirmLabel: 'Revert', danger: true })) return;
                  const r = actions.revertRun(g.runId); toast(`Reverted ${r.reverted}${r.skipped ? `, left ${r.skipped} that people have changed` : ''}`);
                } }]} />}
              </div>
              <ul className="prop-list">{g.items.map(p => <ProposalRow key={p.id} p={p} actions={false} />)}</ul>
            </section>);
        })}</div>)}
    </div>
  );
}

