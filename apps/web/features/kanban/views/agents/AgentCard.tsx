import { useState } from 'react';
import { Avatar, Icon, Pill, Segmented } from '@/components/ui';
import { useStore } from '../../state/store';
import { ConnectAgentDialog } from '../../components/dialogs';
import * as A from '../../lib/agents';
import type { Agent, Trust } from '../../types';
import { TRUST_LABEL, TRUST_TONE } from './labels';
import { StageRules } from './StageRules';

export function AgentCard({ agent, canManage }: { agent: Agent; canManage: boolean }) {
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

