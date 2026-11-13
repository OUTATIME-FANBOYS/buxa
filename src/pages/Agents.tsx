import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Avatar, Empty, Menu, Pill, Segmented, useUi, type Tone } from '../components/ui';
import { Icon } from '../components/Icon';
import { AgentDialog, ConnectAgentDialog } from '../components/dialogs';
import { ago } from '../lib/dates';
import * as A from '../lib/agents';
import type { Agent, Proposal, ProposalKind, ProposalStatus, Trust } from '../types';

type Tab = 'inbox' | 'history' | 'agents';

const STATUS_LABEL: Record<ProposalStatus, string> = { pending: 'Waiting', applied: 'Applied automatically', approved: 'Approved', rejected: 'Rejected', blocked: 'Blocked', reverted: 'Reverted' };
const KIND_ICON: Record<ProposalKind, string> = { create_task: 'plus', comment: 'message', update_task: 'edit', move_task: 'arrowRight', complete_task: 'check' };
const TRUST_LABEL: Record<Trust, string> = { auto: 'Allow', approve: 'Ask me', never: 'Block' };
const TRUST_TONE: Record<Trust, Tone> = { auto: 'ok', approve: 'warn', never: 'crit' };
const STATUS_TONE: Record<ProposalStatus, Tone> = { pending: 'agent', applied: 'neutral', approved: 'ok', rejected: 'crit', blocked: 'warn', reverted: 'neutral' };

export function Agents() {
  const { s, actions, workspace, project, myRole, readOnly } = useStore(); const { toast } = useUi();
  const [tab, setTab] = useState<Tab>('inbox'); const [adding, setAdding] = useState(false);
  const agents = s.agents.filter(a => a.workspaceId === workspace?.id);
  const proposals = useMemo(() => s.proposals.filter(p => agents.some(a => a.userId === p.agentId)), [s.proposals, agents]);
  const pending = proposals.filter(p => p.status === 'pending');
  const canManage = myRole === 'owner' || myRole === 'admin';
  const [simAgent, setSimAgent] = useState('');
  const sim = agents.find(a => a.userId === simAgent) ?? agents[0];
  const simName = s.users.find(u => u.id === sim?.userId)?.name ?? 'The agent';

  if (!workspace) return <Empty title="No workspace" />;
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title"><h1>Agents</h1><p className="muted">Agents propose work. You decide what happens, and everything is recorded.</p></div>
        <div className="page-actions">
          {sim && project && sim.scope.includes(project.id) && !readOnly && (
            <button className="btn" onClick={() => { const n = actions.simulateRun(sim.userId, project.id); toast(n ? `${simName} made ${n} proposal${n === 1 ? '' : 's'} on ${project.name}` : `${simName} found nothing new on ${project.name}`); if (n) setTab('inbox'); }}
              title="A scripted stand-in for a real agent, to try the approval flow">
              <Icon name="agent" size={16} />Try a simulated run
            </button>)}
          {canManage && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add agent</button>}
        </div>
      </header>
      <Segmented<Tab> label="Agents section" value={tab} onChange={setTab} options={[{ value: 'inbox', label: pending.length ? `Inbox (${pending.length})` : 'Inbox' }, { value: 'history', label: 'History' }, { value: 'agents', label: 'Agents' }]} />
      {tab === 'inbox' && <Inbox proposals={pending} />}
      {tab === 'history' && <History proposals={proposals} agents={agents} />}
      {tab === 'agents' && (agents.length === 0
        ? <Empty icon="agent" title="No agents yet" body="Add one to let it propose tasks, comments and changes. It starts out asking before it changes anything." action={canManage ? <button className="btn btn-primary" onClick={() => setAdding(true)}>Add agent</button> : undefined} />
        : <div className="agent-list">{agents.map(a => <AgentCard key={a.userId} agent={a} canManage={canManage} />)}</div>)}
      {adding && <AgentDialog onClose={() => setAdding(false)} />}
      {tab !== 'agents' && agents.length > 1 && sim && (
        <label className="muted small row">Simulated runs use <select className="inline-select" value={sim.userId} onChange={e => setSimAgent(e.target.value)} aria-label="Agent for simulated runs">{agents.map(a => <option key={a.userId} value={a.userId}>{s.users.find(u => u.id === a.userId)?.name}</option>)}</select></label>)}
    </div>
  );
}

/* ---------- a group of proposals from one run ---------- */
function groupByRun(ps: Proposal[]) {
  const m = new Map<string, Proposal[]>(); ps.forEach(p => m.set(p.runId, [...(m.get(p.runId) ?? []), p]));
  return Array.from(m.entries()).map(([runId, items]) => ({ runId, items: items.slice().reverse(), at: items[0].at }));
}

function Inbox({ proposals }: { proposals: Proposal[] }) {
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

function ProposalRow({ p, actions: showActions }: { p: Proposal; actions: boolean }) {
  const { s, actions } = useStore(); const { openTask, toast } = useUi();
  const d = A.describe(s, p.change, p.undo); const kind = A.policyKind(s, p.change); const t = p.taskId ? s.tasks.find(x => x.id === p.taskId) : 'taskId' in p.change ? s.tasks.find(x => x.id === (p.change as { taskId: string }).taskId) : undefined;
  const deciderUser = p.decidedBy ? s.users.find(u => u.id === p.decidedBy) : undefined; const decider = deciderUser ? `${deciderUser.name.split(' ')[0]}${deciderUser.agent ? ' (agent)' : ''}` : undefined;
  return (
    <li className={`prop prop-${p.status}`}>
      <span className="prop-icon" aria-hidden="true"><Icon name={KIND_ICON[kind]} size={15} /></span>
      <div className="prop-main">
        <span className="prop-text">{t ? <>{d.before}<button className="link-inline" onClick={() => openTask(t.id)}>“{d.title}”</button>{d.after}</> : d.text}</span>
        <span className="muted small block">{p.reason}</span>
        {d.diff && <span className="diff small">{d.diff.from && <><span className="diff-from">{d.diff.from}</span><Icon name="arrowRight" size={12} /></>}<span className="diff-to">{d.diff.to}</span></span>}
        {p.note && <span className="small text-crit block">{p.note}</span>}
      </div>
      {p.status === 'pending' && showActions
        ? <div className="row prop-actions">
            <button className="btn btn-sm" onClick={() => actions.decide(p.id, 'reject')} aria-label={`Reject: ${d.text}`}>Reject</button>
            <button className="btn btn-sm btn-primary" onClick={() => { actions.decide(p.id, 'approve'); toast('Approved'); }} aria-label={`Approve: ${d.text}`}>Approve</button></div>
        : <span className="outcome"><Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}{decider && p.status !== 'applied' ? ` by ${decider}` : ''}</Pill></span>}
    </li>
  );
}

/* ---------- audit trail ---------- */
function History({ proposals, agents }: { proposals: Proposal[]; agents: Agent[] }) {
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

/* ---------- agent settings ---------- */
function AgentCard({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const { s, actions, projects, sync } = useStore(); const user = s.users.find(u => u.id === agent.userId); const st = A.agentStats(s, agent.userId); const [connect, setConnect] = useState(false);
  const toggle = (id: string) => actions.updateAgent(agent.userId, { scope: agent.scope.includes(id) ? agent.scope.filter(x => x !== id) : [...agent.scope, id] });
  return (
    <section className="panel agent-card">
      <div className="run-head">
        <Avatar user={user} size={40} />
        <div className="grow"><strong>{user?.name}</strong><span className="muted small block">{agent.model}</span></div>
        <Pill tone={agent.paused ? 'warn' : 'ok'}>{agent.paused ? 'Paused' : 'Active'}</Pill>
        {canManage && <button className="btn btn-sm" onClick={() => actions.updateAgent(agent.userId, { paused: !agent.paused })} aria-pressed={agent.paused}>{agent.paused ? 'Resume' : 'Pause'}</button>}
      </div>
      {agent.purpose && <p className="muted">{agent.purpose}</p>}
      {sync === 'synced'
        ? <div className="row"><button className="btn btn-sm" onClick={() => setConnect(true)} disabled={!canManage}><Icon name="agent" size={15} />Connect to Claude</button></div>
        : <p className="muted small">To connect a real agent, run <code>npm run server</code> and reload. {sync === 'offline' ? 'The server is not answering right now.' : 'Until then only the simulated agent is available.'}</p>}
      {connect && user && <ConnectAgentDialog agentId={agent.userId} name={user.name} onClose={() => setConnect(false)} />}
      <dl className="agent-stats">
        <div><dt>Accepted</dt><dd>{st.acceptance === null ? '—' : `${Math.round(st.acceptance * 100)}%`}</dd></div>
        <div><dt>Waiting</dt><dd>{st.pending}</dd></div>
        <div><dt>Automatic</dt><dd>{st.auto}</dd></div>
        <div><dt>Runs</dt><dd>{st.runs}</dd></div>
      </dl>
      <div className="stack">
        <h3>What it may do</h3>
        <ul className="trust">{A.PROPOSAL_KINDS.map(k => (
          <li key={k}><span>{A.KIND_LABEL[k]}</span>
            {canManage ? <Segmented<Trust> label={`${A.KIND_LABEL[k]} for ${user?.name}`} value={agent.trust[k]} onChange={v => actions.setTrust(agent.userId, k, v)} options={(['auto', 'approve', 'never'] as Trust[]).map(v => ({ value: v, label: TRUST_LABEL[v] }))} />
              : <Pill tone={TRUST_TONE[agent.trust[k]]}>{TRUST_LABEL[agent.trust[k]]}</Pill>}</li>))}</ul>
      </div>
      <StageRules agent={agent} canManage={canManage} />
      <div className="stack">
        <h3>Reviewing other agents’ work</h3>
        <p className="muted small">Lets this agent approve or reject what another agent proposes. It never reviews its own work, only in its projects, and people can always overrule it.</p>
        <div className="row">{A.PROPOSAL_KINDS.map(k => (
          <label key={k} className="chip chip-check"><input type="checkbox" disabled={!canManage} checked={agent.approves.includes(k)}
            onChange={() => actions.setApproves(agent.userId, agent.approves.includes(k) ? agent.approves.filter(x => x !== k) : [...agent.approves, k])} /> {A.KIND_LABEL[k]}</label>))}</div>
      </div>
      <div className="stack">
        <h3>Projects it may touch</h3>
        <div className="row">{projects.map(p => (
          <label key={p.id} className="chip chip-check"><input type="checkbox" disabled={!canManage} checked={agent.scope.includes(p.id)} onChange={() => toggle(p.id)} /> {p.name}</label>))}</div>
      </div>
    </section>
  );
}

/** Which stages this agent may move tasks into, one project at a time. "Default" falls back to its general move policy. */
type StageChoice = 'default' | Trust;
function StageRules({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const { actions, projects } = useStore();
  const scoped = projects.filter(p => agent.scope.includes(p.id));
  const [pid, setPid] = useState(''); const project = scoped.find(p => p.id === pid) ?? scoped[0];
  if (!project) return null;
  const label: Record<StageChoice, string> = { default: 'Default', auto: 'Allow', approve: 'Ask me', never: 'Block' };
  return (
    <div className="stack">
      <h3>Moving tasks between stages</h3>
      <p className="muted small">Choose per stage whether this agent may move a task <em>into</em> it. “Default” uses its general move policy above.</p>
      {scoped.length > 1 && <select className="inline-select" aria-label="Project for stage rules" value={project.id} onChange={e => setPid(e.target.value)}>{scoped.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      <ul className="trust">{project.columns.map(c => (
        <li key={c.id}><span>{c.name}<i className={`kind-dot kind-${c.kind} stage-dot`} aria-hidden="true" /></span>
          {canManage
            ? <select className="inline-select stage-select" aria-label={`Moving into ${c.name}`} value={agent.moveRules[c.id] ?? 'default'} onChange={e => { const v = e.target.value as StageChoice; actions.setMoveRule(agent.userId, c.id, v === 'default' ? null : v); }}>
                {(['default', 'auto', 'approve', 'never'] as StageChoice[]).map(v => <option key={v} value={v}>{label[v]}</option>)}</select>
            : <Pill tone={agent.moveRules[c.id] ? TRUST_TONE[agent.moveRules[c.id]] : 'neutral'}>{label[agent.moveRules[c.id] ?? 'default']}</Pill>}</li>))}</ul>
    </div>
  );
}
