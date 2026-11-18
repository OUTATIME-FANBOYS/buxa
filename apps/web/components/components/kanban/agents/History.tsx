'use client';

import { useState } from 'react';
import { Avatar, Button } from '@/components/elements/export';
import { Empty } from '@/components/components/export';
import { Select } from '@/components/atoms';
import { Icon } from '@/components/elements/export';
import { Menu } from '@/components/components/export';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { useStore } from '@buxa/middleware/providers/providers';
import { ago } from '@buxa/shared';
import * as A from '@buxa/shared';
import type { Agent, Proposal, ProposalStatus } from '@buxa/shared';
import { groupByRun } from '@buxa/shared';
import { ProposalRow } from './ProposalRow';
import { STATUS_LABEL } from '@buxa/shared';

/** The audit trail: every decided proposal, filterable, exportable, and revertible per run. */
export function History({ proposals, agents }: { proposals: Proposal[]; agents: Agent[] }) {
  const { s, me, actions } = useStore();
  const { confirm, toast } = useUi();
  const [status, setStatus] = useState<'all' | ProposalStatus>('all');
  const [agent, setAgent] = useState('all');
  const shown = proposals.filter(
    p =>
      p.status !== 'pending' && (status === 'all' || p.status === status) && (agent === 'all' || p.agentId === agent),
  );
  const groups = groupByRun(shown);
  const exportAudit = () => {
    const rows = proposals.map(p => ({
      at: p.at,
      agent: s.users.find(u => u.id === p.agentId)?.name,
      run: s.runs.find(r => r.id === p.runId)?.label,
      action: A.describe(s, p.change).text,
      reason: p.reason,
      status: p.status,
      decidedBy: s.users.find(u => u.id === p.decidedBy)?.name,
      decidedAt: p.decidedAt,
      note: p.note,
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <div className="row filters">
        <Select
          label="Filter by outcome"
          hideLabel
          className="inline-select"
          value={status}
          onChange={value => setStatus((value ?? 'all') as 'all' | ProposalStatus)}
          options={[
            { value: 'all', label: 'All outcomes' },
            ...(['applied', 'approved', 'rejected', 'blocked', 'reverted'] as ProposalStatus[]).map(x => ({
              value: x,
              label: STATUS_LABEL[x],
            })),
          ]}
        />
        {agents.length > 1 && (
          <Select
            label="Filter by agent"
            hideLabel
            className="inline-select"
            value={agent}
            onChange={value => setAgent(value ?? 'all')}
            options={[
              { value: 'all', label: 'All agents' },
              ...agents.map(a => ({ value: a.userId, label: s.users.find(u => u.id === a.userId)?.name ?? a.userId })),
            ]}
          />
        )}
        <span className="grow" />
        <Button size="sm" icon="download" onClick={exportAudit} disabled={!proposals.length}>
          Export audit log
        </Button>
      </div>
      {!groups.length ? (
        <Empty
          icon="inbox"
          title="No history yet"
          body="Everything an agent does, and every decision you make, is recorded here."
        />
      ) : (
        <div className="run-list">
          {groups.map(g => {
            const run = s.runs.find(r => r.id === g.runId);
            const agentId = g.items[0].agentId;
            const revertable = g.items.filter(
              p => (p.status === 'applied' || p.status === 'approved') && p.undo,
            ).length;

            return (
              <section key={g.runId} className="panel run">
                <div className="run-head">
                  <Avatar user={s.users.find(u => u.id === agentId)} size={32} />
                  <div className="grow">
                    <strong>{run?.label ?? 'Agent run'}</strong>
                    <span className="muted small block">
                      {s.users.find(u => u.id === agentId)?.name} · {ago(g.at)}
                      {run?.simulated ? ' · simulated' : ''}
                      {run?.costUsd ? ` · $${run.costUsd.toFixed(2)}` : ''}
                    </span>
                  </div>
                  {revertable > 0 && A.canDecide(s, me?.id, agentId) && (
                    <Menu
                      label="Run actions"
                      trigger={<Icon name="more" />}
                      items={[
                        {
                          label: `Revert ${revertable} change${revertable === 1 ? '' : 's'}`,
                          icon: 'undo',
                          danger: true,
                          onSelect: () =>
                            void (async () => {
                              if (
                                !(await confirm({
                                  title: 'Revert this run?',
                                  body: 'Its changes are undone where nobody has worked on them since. Anything a person has touched is left as it is.',
                                  confirmLabel: 'Revert',
                                  danger: true,
                                }))
                              ) {
                                return;
                              }
                              const r = actions.revertRun(g.runId);
                              toast(
                                `Reverted ${r.reverted}${r.skipped ? `, left ${r.skipped} that people have changed` : ''}`,
                              );
                            })(),
                        },
                      ]}
                    />
                  )}
                </div>
                <ul className="prop-list">
                  {g.items.map(p => (
                    <ProposalRow key={p.id} p={p} actions={false} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
