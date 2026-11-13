import { Avatar, Empty, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import { ago } from '../../lib/dates';
import * as A from '../../lib/agents';
import type { Proposal } from '../../types';
import { groupByRun } from './groupByRun';
import { ProposalRow } from './ProposalRow';

export function Inbox({ proposals }: { proposals: Proposal[] }) {
  const { s, me, actions } = useStore(); const { toast } = useUi();
  const groups = groupByRun(proposals);
  if (!groups.length) return <Empty icon="check" title="Nothing waiting for you" body="When an agent proposes something that needs a decision, it will show up here." />;
  return (
    <div className="run-list">
      {groups.map(g => {
        const run = s.runs.find(r => r.id === g.runId); const agentId = g.items[0].agentId; const can = A.canDecide(s, me?.id, agentId);
        const ids = g.items.map(p => p.id);
        return (
          <section key={g.runId} className="panel run">
            <div className="run-head">
              <Avatar user={s.users.find(u => u.id === agentId)} size={32} />
              <div className="grow"><strong>{run?.label ?? 'Agent run'}</strong><span className="muted small block">{s.users.find(u => u.id === agentId)?.name} · {ago(g.at)}{run?.simulated ? ' · simulated' : ''}</span></div>
              {can && g.items.length > 1 && <div className="row">
                <button className="btn btn-sm" onClick={() => { actions.decideMany(ids, 'reject'); toast(`Rejected ${ids.length} proposals`); }}>Reject all</button>
                <button className="btn btn-sm btn-primary" onClick={() => { actions.decideMany(ids, 'approve'); toast(`Approved ${ids.length} proposals`); }}>Approve all</button></div>}
            </div>
            <ul className="prop-list">{g.items.map(p => <ProposalRow key={p.id} p={p} actions={can} />)}</ul>
          </section>);
      })}
    </div>
  );
}

