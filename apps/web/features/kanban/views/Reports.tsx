import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Empty, Progress, Segmented } from '@/components/ui';
import { Bars, HBars, Legend, Ring } from '../components/charts';
import { Stat } from './Dashboard';
import { addDays, diffDays, fmt, isoDay, today } from '../lib/dates';
import { PRIORITIES, PRIORITY_LABEL } from '../lib/tasks';
import { Avatar, Pill } from '@/components/ui';
import { HEALTH_LABEL, HEALTH_TONE, healthOf, isOverdue, progressOf, summarize } from '../lib/stats';
import { AgentSummary } from '../components/AgentSummary';

export function Reports() {
  const { wsTasks, projects, kindOf, members, workspace } = useStore();
  const [range, setRange] = useState<'14' | '30' | '90'>('30');
  const { live, done, open, overdue, progress } = summarize(wsTasks, kindOf); const rate = progress.pct;
  const durations = done.filter(t => t.completedAt).map(t => Math.max(0, diffDays(isoDay(t.completedAt!), isoDay(t.createdAt))));
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const series = useMemo(() => {
    const n = Number(range);
    if (n <= 30) return Array.from({ length: n }, (_, i) => { const d = addDays(today(), i - n + 1); return { label: fmt(d), title: fmt(d, true), value: done.filter(t => t.completedAt && isoDay(t.completedAt) === d).length }; });
    return Array.from({ length: 13 }, (_, i) => {
      const end = addDays(today(), -(12 - i) * 7); const start = addDays(end, -6);
      return { label: fmt(start), title: `${fmt(start)} – ${fmt(end)}`, value: done.filter(t => { if (!t.completedAt) return false; const c = isoDay(t.completedAt); return c >= start && c <= end; }).length };
    });
  }, [range, done]);
  const total = series.reduce((a, b) => a + b.value, 0);

  if (!workspace || live.length === 0) return <div className="page"><header className="page-head"><div className="page-title"><h1>Reports</h1></div></header><Empty icon="chart" title="Nothing to report yet" body="Reports fill in as tasks are created and completed." /></div>;

  const prioRows = PRIORITIES.slice().reverse().map(p => ({ label: PRIORITY_LABEL[p], segments: [{ value: open.filter(t => t.priority === p).length, className: `seg-${p}`, name: 'open' }] }));
  const load = members.map(m => ({ m, on: open.filter(t => t.assigneeId === m.userId && !isOverdue(t, kindOf)).length, late: open.filter(t => t.assigneeId === m.userId && isOverdue(t, kindOf)).length }))
    .sort((a, b) => b.on + b.late - (a.on + a.late));
  const unassigned = open.filter(t => !t.assigneeId).length;
  const lateBy = load.filter(l => l.late > 0);

  return (
    <div className="page">
      <header className="page-head"><div className="page-title"><h1>Reports</h1><p className="muted">{workspace.name} · all projects</p></div>
        <div className="page-actions"><Segmented label="Time range" value={range} onChange={setRange} options={[{ value: '14', label: '14 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} /></div></header>
      <div className="stats">
        <Stat label="Completion rate" value={`${Math.round(rate)}%`} note={`${done.length} of ${live.length} tasks`} tone="ok" icon="check" />
        <Stat label={`Completed, ${range} days`} value={total} note={`${(total / Number(range) * 7).toFixed(1)} per week`} tone="brand" icon="chart" />
        <Stat label="Avg. time to complete" value={durations.length ? `${avg.toFixed(1)}d` : '—'} note="from creation to done" icon="clock" />
        <Stat label="Overdue" value={overdue.length} note={`${open.length ? Math.round((overdue.length / open.length) * 100) : 0}% of open tasks`} tone={overdue.length ? 'crit' : 'ok'} icon={overdue.length ? 'alert' : 'check'} strong={overdue.length > 0} />
      </div>
      <div className="grid-2">
        <section className="panel"><h2>Tasks completed over time</h2><Bars tone="ok" data={series} ariaLabel={`Tasks completed over the last ${range} days, ${total} in total`} unit={Number(range) > 30 ? 'tasks that week' : 'tasks'} /></section>
        <section className="panel"><h2>Project progress</h2>
          <ul className="proj-bars big">{projects.map(p => { const pr = progressOf(live.filter(x => x.projectId === p.id), kindOf); const h = healthOf(pr, p.deadline);
            return <li key={p.id}><a href={'#/board/' + p.id}><span>{p.name}</span><span className="pb-meta"><Pill tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Pill><span className="muted small">{pr.done}/{pr.total} · {Math.round(pr.pct)}%</span></span></a><Progress value={pr.pct} tone={HEALTH_TONE[h]} label={`${p.name} progress`} /></li>; })}</ul>
        </section>
      </div>
      <div className="grid-3">
        <section className="panel"><h2>Workload by member</h2><Legend items={[{ name: 'On track', className: 'seg-brand' }, { name: 'Overdue', className: 'seg-crit' }]} />
          <HBars ariaLabel="Open tasks per team member" rows={load.map(l => ({ label: <span className="who"><Avatar user={l.m.user} size={20} />{l.m.user.name.split(' ')[0]}</span>, segments: [{ value: l.on, className: 'seg-brand', name: 'on track' }, { value: l.late, className: 'seg-crit', name: 'overdue' }] }))} />
          {unassigned > 0 && <p className="muted small">{unassigned} open task{unassigned === 1 ? ' is' : 's are'} unassigned.</p>}
        </section>
        <section className="panel"><h2>Open tasks by priority</h2><HBars ariaLabel="Open tasks by priority" rows={prioRows} /></section>
        <section className="panel"><h2>Overdue</h2>
          <div className="overdue-sum"><Ring value={open.length ? (overdue.length / open.length) * 100 : 0} size={96} stroke={8} label="of open" tone={overdue.length ? 'crit' : 'ok'} /><div><span className="stat-num">{overdue.length}</span><span className="muted small block">overdue tasks</span></div></div>
          {lateBy.length === 0 ? <p className="muted small">No one has overdue work.</p> :
            <HBars ariaLabel="Overdue tasks per team member" rows={lateBy.map(l => ({ label: l.m.user.name.split(' ')[0], segments: [{ value: l.late, className: 'seg-crit', name: 'overdue' }] }))} />}
        </section>
      </div>
      <AgentSummary detailed />
    </div>
  );
}
