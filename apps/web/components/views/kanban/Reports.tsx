'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { boardPath } from '@/config/routes';
import { useStore } from '@buxa/middleware/providers/providers';
import { Progress } from '@/components/elements';
import { Segmented } from '@/components/elements';
import { Bars, ChartCard } from '@/components/components/charts';
import { HBars } from '@/components/components/charts';
import { Legend } from '@/components/elements';
import { Ring } from '@/components/elements';
import { StatCard as Stat } from '@/components/components/kanban/home';
import { PRIORITY_LABEL } from '@buxa/shared';
import { Avatar } from '@/components/elements';
import { Pill } from '@/components/elements';
import {
  HEALTH_LABEL,
  HEALTH_TONE,
  avgCycleDays,
  completionSeries,
  healthOf,
  memberLoad,
  overdueByMember,
  priorityCounts,
  progressOf,
  summarize,
  unassignedCount,
} from '@buxa/shared';
import { AgentSummary } from '@/components/components/kanban';

export function Reports() {
  const { wsTasks, projects, kindOf, members, workspace } = useStore();
  const [range, setRange] = useState<'14' | '30' | '90'>('30');
  const { live, done, open, overdue, progress } = summarize(wsTasks, kindOf);
  const rate = progress.pct;
  const avg = avgCycleDays(done);

  const series = useMemo(() => completionSeries(done, Number(range)), [range, done]);
  const total = series.reduce((a, b) => a + b.value, 0);

  const prioRows = priorityCounts(open)
    .reverse()
    .map(({ priority, count }) => ({
      label: PRIORITY_LABEL[priority],
      segments: [{ value: count, className: `seg-${priority}`, name: 'open' }],
    }));
  const load = memberLoad(open, members, kindOf);
  const unassigned = unassignedCount(open);
  const lateBy = overdueByMember(load);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <h1>Reports</h1>
          <p className="muted">{workspace ? `${workspace.name} · all projects` : 'All projects'}</p>
        </div>
        <div className="page-actions">
          <Segmented
            label="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        </div>
      </header>
      <div className="stats">
        <Stat
          label="Completion rate"
          value={`${Math.round(rate)}%`}
          note={`${done.length} of ${live.length} tasks`}
          tone="ok"
          icon="check"
        />
        <Stat
          label={`Completed, ${range} days`}
          value={total}
          note={`${((total / Number(range)) * 7).toFixed(1)} per week`}
          tone="brand"
          icon="chart"
          spark={{
            values: series.map(s => s.value),
            ariaLabel: `Tasks completed per ${Number(range) > 30 ? 'week' : 'day'}, last ${range} days`,
          }}
        />
        <Stat
          label="Avg. time to complete"
          value={avg === null ? '–' : `${avg.toFixed(1)}d`}
          note="from creation to done"
          icon="clock"
        />
        <Stat
          label="Overdue"
          value={overdue.length}
          note={`${open.length ? Math.round((overdue.length / open.length) * 100) : 0}% of open tasks`}
          tone={overdue.length ? 'crit' : 'ok'}
          icon={overdue.length ? 'alert' : 'check'}
          strong={overdue.length > 0}
        />
      </div>
      <div className="grid-2">
        <ChartCard
          title="Tasks completed over time"
          value={total}
          subtitle={`${((total / Number(range)) * 7).toFixed(1)} per week`}
          legend={[{ name: 'Completed', tone: 'ok' }]}
          table={{
            caption: `Tasks completed over the last ${range} days, ${total} in total`,
            headers: [Number(range) > 30 ? 'Week' : 'Day', 'Tasks completed'],
            rows: series.map(s => ({ label: s.title, value: s.value })),
          }}
        >
          <Bars
            tone="ok"
            data={series}
            ariaLabel={`Tasks completed over the last ${range} days, ${total} in total`}
            unit={Number(range) > 30 ? 'tasks that week' : 'tasks'}
          />
          {total === 0 && <p className="muted small">No completed tasks in this period yet</p>}
        </ChartCard>
        <section className="panel">
          <h2>Project progress</h2>
          {projects.length === 0 ? (
            <p className="muted small">No projects yet.</p>
          ) : (
            <ul className="proj-bars big">
              {projects.map(p => {
                const pr = progressOf(
                  live.filter(x => x.projectId === p.id),
                  kindOf,
                );
                const h = healthOf(pr, p.deadline);

                return (
                  <li key={p.id}>
                    <Link href={boardPath(p.id)}>
                      <span>{p.name}</span>
                      <span className="pb-meta">
                        <Pill tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Pill>
                        <span className="muted small">
                          {pr.done}/{pr.total} · {Math.round(pr.pct)}%
                        </span>
                      </span>
                    </Link>
                    <Progress value={pr.pct} tone={HEALTH_TONE[h]} label={`${p.name} progress`} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <div className="grid-3">
        <section className="panel">
          <h2>Workload by member</h2>
          {open.length === 0 ? (
            <p className="muted small">No open tasks yet.</p>
          ) : (
            <>
              <Legend
                items={[
                  { name: 'On track', className: 'seg-brand' },
                  { name: 'Overdue', className: 'seg-crit' },
                ]}
              />
              <HBars
                ariaLabel="Open tasks per team member"
                rows={load.map(l => ({
                  label: (
                    <span className="who">
                      <Avatar user={l.member.user} size={20} />
                      {l.member.user.name.split(' ')[0]}
                    </span>
                  ),
                  segments: [
                    { value: l.on, className: 'seg-brand', name: 'on track' },
                    { value: l.late, className: 'seg-crit', name: 'overdue' },
                  ],
                }))}
              />
            </>
          )}
          {unassigned > 0 && (
            <p className="muted small">
              {unassigned} open task{unassigned === 1 ? ' is' : 's are'} unassigned.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Open tasks by priority</h2>
          {open.length === 0 ? (
            <p className="muted small">No open tasks yet.</p>
          ) : (
            <HBars ariaLabel="Open tasks by priority" rows={prioRows} />
          )}
        </section>
        <section className="panel">
          <h2>Overdue</h2>
          <div className="overdue-sum">
            <Ring
              value={open.length ? (overdue.length / open.length) * 100 : 0}
              size={96}
              stroke={8}
              label="of open"
              tone={overdue.length ? 'crit' : 'ok'}
            />
            <div>
              <span className="stat-num">{overdue.length}</span>
              <span className="muted small block">overdue tasks</span>
            </div>
          </div>
          {lateBy.length === 0 ? (
            <p className="muted small">No one has overdue work.</p>
          ) : (
            <HBars
              ariaLabel="Overdue tasks per team member"
              rows={lateBy.map(l => ({
                label: l.member.user.name.split(' ')[0],
                segments: [{ value: l.late, className: 'seg-crit', name: 'overdue' }],
              }))}
            />
          )}
        </section>
      </div>
      <AgentSummary detailed />
    </div>
  );
}
