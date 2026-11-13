import { useMemo } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Avatar, Empty, Pill, Progress, PriorityMark, useUi, type Tone } from '../components/ui';
import { Bars, Ring, StatusBar } from '../components/charts';
import { DueChip } from '../components/Board';
import { addDays, ago, diffDays, fmt, isoDay, today } from '../lib/dates';
import { navigate } from '../lib/router';
import { HEALTH_LABEL, HEALTH_TONE, healthOf, progressOf, summarize } from '../lib/stats';
import { AgentSummary } from '../components/AgentSummary';

export function Stat({ label, value, note, tone = 'neutral', icon, strong }: { label: string; value: number | string; note?: string; tone?: Tone; icon?: string; strong?: boolean }) {
  return (
    <div className={`stat tone-${tone} ${strong ? 'stat-strong' : ''}`}>
      <span className="stat-top"><span className="stat-label">{label}</span>{icon && <span className="stat-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>}</span>
      <span className="stat-num">{value}</span>{note && <span className="muted small">{note}</span>}
    </div>
  );
}

export function ActivityList({ items, limit = 8 }: { items: ReturnType<typeof useStore>['s']['activity']; limit?: number }) {
  const { userById, s } = useStore(); const { openTask } = useUi();
  if (!items.length) return <Empty icon="inbox" title="No activity yet" body="Updates appear here as your team works." />;
  return (
    <ul className="activity">
      {items.slice(0, limit).map(a => {
        const u = userById(a.actorId); const exists = a.taskId && s.tasks.some(t => t.id === a.taskId);
        return (
          <li key={a.id}><Avatar user={u} size={28} />
            <div><span><strong>{u?.name ?? 'Someone'}</strong> {a.verb} {exists ? <button className="link-inline" onClick={() => openTask(a.taskId!)}>{a.taskTitle}</button> : <em>{a.taskTitle}</em>} {a.detail}</span>
              {a.via && <span className="via"><Icon name="agent" size={12} />{a.via.reason}</span>}
              <span className="muted small block">{ago(a.at)}</span></div></li>
        );
      })}
    </ul>
  );
}

export function Dashboard() {
  const { s, me, wsTasks, projects, kindOf, workspace, userById } = useStore(); const { openTask } = useUi();
  const { live, done, active: prog, open, overdue, progress } = summarize(wsTasks, kindOf); const pct = progress.pct;
  const notStarted = open.length - prog.length;
  const upcoming = live.filter(t => kindOf(t) !== 'done' && t.due && t.due >= today()).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 6);
  const mineAttention = overdue.filter(t => t.assigneeId === me?.id).length + live.filter(t => t.assigneeId === me?.id && kindOf(t) !== 'done' && t.due && diffDays(t.due, today()) >= 0 && diffDays(t.due, today()) <= 2).length;
  const series = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today(), i - 13); return { label: fmt(day), value: live.filter(t => t.completedAt && isoDay(t.completedAt) === day).length, title: fmt(day, true) };
  }), [live]);
  const activity = s.activity.filter(a => projects.some(p => p.id === a.projectId));
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!workspace) return <Empty icon="folder" title="No workspace" />;
  return (
    <div className="page">
      <header className="page-head"><div className="page-title">
        <h1>{greet}, {me?.name.split(' ')[0]}</h1>
        <p className="muted">{mineAttention ? `${mineAttention} of your tasks need attention today.` : 'Nothing urgent on your plate. Nicely done.'} <span className="muted">{workspace.name}</span></p>
      </div></header>
      {live.length === 0 ? <Empty icon="kanban" title="No tasks in this workspace yet" body="Create a project and add your first task." action={<button className="btn btn-primary" onClick={() => navigate('/projects')}>Go to projects</button>} /> : <>
        <div className="stats">
          <Stat label="Total tasks" value={live.length} note={`${projects.length} project${projects.length === 1 ? '' : 's'}`} icon="tasks" />
          <Stat label="In progress" value={prog.length} note="being worked on" tone="brand" icon="timeline" />
          <Stat label="Completed" value={done.length} note={`${Math.round(pct)}% of all tasks`} tone="ok" icon="check" />
          <Stat label="Overdue" value={overdue.length} note={overdue.length ? 'past their due date' : 'all on schedule'} tone={overdue.length ? 'crit' : 'ok'} icon={overdue.length ? 'alert' : 'check'} strong={overdue.length > 0} />
        </div>
        <section className="panel"><div className="panel-head"><h2>Work by status</h2>{overdue.length > 0 && <Pill tone="crit">{overdue.length} overdue</Pill>}</div>
          <StatusBar ariaLabel="Tasks by status" parts={[{ name: 'Not started', value: notStarted, tone: 'neutral' }, { name: 'In progress', value: prog.length, tone: 'brand' }, { name: 'Done', value: done.length, tone: 'ok' }]} />
        </section>
        <div className="grid-2">
          <section className="panel"><h2>Overall completion</h2>
            <div className="completion">
              <Ring value={pct} label="complete" tone="ok" />
              <ul className="proj-bars">
                {projects.map(p => {
                  const pr = progressOf(live.filter(x => x.projectId === p.id), kindOf); const h = healthOf(pr, p.deadline);
                  return <li key={p.id}><a href={'#/board/' + p.id}><span>{p.name}</span><span className="pb-meta"><Pill tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Pill><span className="muted small">{Math.round(pr.pct)}%</span></span></a><Progress value={pr.pct} tone={HEALTH_TONE[h]} label={`${p.name} completion`} /></li>;
                })}
              </ul>
            </div>
          </section>
          <section className="panel"><h2>Completed, last 14 days</h2>
            <Bars tone="ok" data={series} ariaLabel={`Tasks completed per day over the last 14 days. ${series.reduce((a, b) => a + b.value, 0)} in total.`} />
          </section>
        </div>
        <div className="grid-2">
          <section className="panel"><div className="panel-head"><h2>Upcoming deadlines</h2><a className="link" href="#/calendar">Calendar</a></div>
            {upcoming.length === 0 ? <Empty icon="calendar" title="No upcoming deadlines" /> : (
              <ul className="rows">{upcoming.map(t => (
                <li key={t.id}><button onClick={() => openTask(t.id)} className="row-btn"><PriorityMark priority={t.priority} /><span className="row-main">{t.title}<span className="muted small block">{projects.find(p => p.id === t.projectId)?.name}</span></span><DueChip due={t.due} kind={kindOf(t)} /><Avatar user={userById(t.assigneeId)} size={22} /></button></li>
              ))}</ul>)}
          </section>
          <section className="panel"><h2>Recent activity</h2><ActivityList items={activity} /></section>
        </div>
        <AgentSummary />
      </>}
    </div>
  );
}
