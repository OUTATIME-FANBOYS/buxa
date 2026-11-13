import { useMemo, useState } from 'react';
import { Empty, Icon, Segmented, useUi } from '@/components/ui';
import { useStore } from '../state/store';
import { AgentDialog } from '../components/dialogs';
import { AgentCard } from './agents/AgentCard';
import { History } from './agents/History';
import { Inbox } from './agents/Inbox';

type Tab = 'inbox' | 'history' | 'agents';


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

