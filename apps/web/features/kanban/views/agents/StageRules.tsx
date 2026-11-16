import { useState } from 'react';
import { useStore } from '../../state/store';
import { Pill } from '@/components/ui';
import { TRUST_TONE } from './labels';
import type { Agent, Trust } from '../../types';

/** Which stages this agent may move tasks into, one project at a time. "Default" falls back to its general move policy. */
type StageChoice = 'default' | Trust;
export function StageRules({ agent, canManage }: { agent: Agent; canManage: boolean }) {
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

