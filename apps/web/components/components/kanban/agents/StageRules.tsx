'use client';

import { useState } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { Pill } from '@/components/elements';
import { Select } from '@/components/atoms';
import { TRUST_TONE } from '@buxa/shared';
import type { Agent, Trust } from '@buxa/shared';

/** Which stages this agent may move tasks into, one project at a time. "Default" falls back to its general move policy. */
type StageChoice = 'default' | Trust;
export function StageRules({ agent, canManage }: { agent: Agent; canManage: boolean }) {
  const { actions, projects } = useStore();
  const scoped = projects.filter(p => agent.scope.includes(p.id));
  const [pid, setPid] = useState('');
  const project = scoped.find(p => p.id === pid) ?? scoped[0];
  if (!project) {
    return null;
  }
  const label: Record<StageChoice, string> = { default: 'Default', auto: 'Allow', approve: 'Ask me', never: 'Block' };

  return (
    <div className="stack">
      <h3>Moving tasks between stages</h3>
      <p className="muted small">
        Choose per stage whether this agent may move a task <em>into</em> it. “Default” uses its general move policy
        above.
      </p>
      {scoped.length > 1 && (
        <Select
          label="Project for stage rules"
          hideLabel
          className="inline-select"
          value={project.id}
          onChange={value => {
            if (value) {
              setPid(value);
            }
          }}
          options={scoped.map(p => ({ value: p.id, label: p.name }))}
        />
      )}
      <ul className="trust">
        {project.columns.map(c => (
          <li key={c.id}>
            <span>
              {c.name}
              <i className={`kind-dot kind-${c.kind} stage-dot`} aria-hidden="true" />
            </span>
            {canManage ? (
              <Select
                label={`Moving into ${c.name}`}
                hideLabel
                className="inline-select stage-select"
                value={agent.moveRules[c.id] ?? 'default'}
                onChange={value => {
                  const v = (value ?? 'default') as StageChoice;
                  actions.setMoveRule(agent.userId, c.id, v === 'default' ? null : v);
                }}
                options={(['default', 'auto', 'approve', 'never'] as StageChoice[]).map(v => ({
                  value: v,
                  label: label[v],
                }))}
              />
            ) : (
              <Pill tone={agent.moveRules[c.id] ? TRUST_TONE[agent.moveRules[c.id]] : 'neutral'}>
                {label[agent.moveRules[c.id] ?? 'default']}
              </Pill>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
