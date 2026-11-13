import { useStore } from '../store';
import { Ring, HBars, Legend } from './charts';
import { Avatar } from './ui';
import { Icon } from './Icon';
import * as A from '../lib/agents';

/** Agent work at a glance. Renders nothing unless agents are on and this workspace has one, so plain boards stay plain. */
export function AgentSummary({ detailed = false }: { detailed?: boolean }) {
  const { s, workspace } = useStore();
  const agents = s.agents.filter(a => a.workspaceId === workspace?.id);
  if (!s.ui.agentsEnabled || !agents.length) return null;
  const scoped = { ...s, proposals: s.proposals.filter(p => agents.some(a => a.userId === p.agentId)), runs: s.runs.filter(r => agents.some(a => a.userId === r.agentId)) };
  const st = A.agentStats(scoped);
  const rows = agents.map(a => { const x = A.agentStats(scoped, a.userId); return { a, x }; });
  return (
    <section className="panel"><div className="panel-head"><h2><span className="h-icon tone-agent"><Icon name="agent" size={14} /></span>Agent work</h2><a className="link" href="#/agents">{st.pending ? `${st.pending} waiting for you` : 'Open agents'}</a></div>
      {st.total === 0 ? <p className="muted">No agent activity yet. Try a simulated run from the Agents page.</p> : (
        <div className={detailed ? 'agent-sum detailed' : 'agent-sum'}>
          <div className="agent-ring">
            <Ring value={(st.acceptance ?? 0) * 100} size={detailed ? 112 : 96} stroke={8} label="accepted" tone="agent" />
            <span className="muted small">{st.acceptance === null ? 'No decisions yet' : `${st.approved} of ${st.approved + st.rejected} decided`}</span>
          </div>
          <div className="stack">
            <dl className="agent-stats">
              <div><dt>Waiting</dt><dd>{st.pending}</dd></div><div><dt>Automatic</dt><dd>{st.auto}</dd></div>
              <div><dt>Rejected</dt><dd>{st.rejected}</dd></div><div><dt>Reverted</dt><dd>{st.reverted}</dd></div>
            </dl>
            {detailed && <>
              <Legend items={[{ name: 'Automatic', className: 'seg-neutral' }, { name: 'Approved', className: 'seg-ok' }, { name: 'Blocked', className: 'seg-warn' }, { name: 'Rejected', className: 'seg-crit' }]} />
              <HBars ariaLabel="Agent proposals by outcome" rows={rows.map(({ a, x }) => ({
                label: <span className="who"><Avatar user={s.users.find(u => u.id === a.userId)} size={20} />{s.users.find(u => u.id === a.userId)?.name.split(' ')[0]}</span>,
                segments: [{ value: x.auto, className: 'seg-neutral', name: 'automatic' }, { value: x.approved, className: 'seg-ok', name: 'approved' }, { value: x.blocked, className: 'seg-warn', name: 'blocked' }, { value: x.rejected, className: 'seg-crit', name: 'rejected' }],
              }))} />
              {st.costUsd > 0 && <p className="muted small">Reported cost across runs: ${st.costUsd.toFixed(2)}</p>}
            </>}
          </div>
        </div>)}
    </section>
  );
}
