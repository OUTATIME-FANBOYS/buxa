import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Avatar, Empty, Progress, Segmented, useUi, Pill } from '../components/ui';
import { BoardView } from '../components/Board';
import { CalendarView, ListView, TimelineView } from '../components/Views';
import { FilterBar } from '../components/FilterBar';
import { ProjectDialog } from '../components/dialogs';
import { emptyFilter, matchesFilter, sortTasks } from '../lib/tasks';
import { diffDays, fmt, today } from '../lib/dates';
import type { Filter, ViewKind } from '../types';
import { navigate } from '../lib/router';
import { HEALTH_LABEL, HEALTH_TONE, healthOf, progressOf } from '../lib/stats';

export function BoardPage({ projectId }: { projectId?: string }) {
  const { s, actions, project, projects, kindOf, readOnly, members } = useStore(); const { openTask } = useUi();
  const [filter, setFilter] = useState<Filter>(emptyFilter); const [edit, setEdit] = useState(false);
  const target = projectId ? s.projects.find(p => p.id === projectId) : project;

  useEffect(() => { if (target && target.id !== s.ui.projectId) actions.selectProject(target.id); }, [target?.id]); // eslint-disable-line
  useEffect(() => { setFilter(emptyFilter); }, [target?.id]);

  const all = useMemo(() => s.tasks.filter(t => t.projectId === target?.id), [s.tasks, target?.id]);
  const tags = useMemo(() => Array.from(new Set(all.flatMap(t => t.tags))).sort(), [all]);
  const visible = useMemo(() => sortTasks(all.filter(t => matchesFilter(t, filter, kindOf(t))), filter.sort), [all, filter, kindOf]); // eslint-disable-line

  if (projectId && !target) return <Empty icon="alert" title="That project doesn’t exist" body="It may have been deleted." action={<button className="btn" onClick={() => navigate('/projects')}>Back to projects</button>} />;
  if (!target) return <Empty icon="folder" title="No projects yet" body="Create a project to get your first board." action={<button className="btn btn-primary" onClick={() => navigate('/projects')}>Go to projects</button>} />;

  const pr = progressOf(all, kindOf); const { done, total: liveCount, pct } = pr; const health = healthOf(pr, target.deadline);
  const view = s.ui.view;
  const left = target.deadline ? diffDays(target.deadline, today()) : null;
  const options: { value: ViewKind; label: string; icon: string }[] = [
    { value: 'board', label: 'Board', icon: 'kanban' }, { value: 'list', label: 'List', icon: 'list' },
    { value: 'calendar', label: 'Calendar', icon: 'calendar' }, { value: 'timeline', label: 'Timeline', icon: 'timeline' }];

  return (
    <div className="page page-board">
      <header className="page-head">
        <div className="page-title">
          <h1>{target.name}</h1>
          {target.description && <p className="muted clamp">{target.description}</p>}
          <div className="proj-meta">
            <Pill tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Pill>
            <div className="proj-progress"><Progress value={pct} tone={HEALTH_TONE[health]} label="Project completion" /><span className="small"><strong>{Math.round(pct)}%</strong> complete · {done} of {liveCount} tasks</span></div>
            {left !== null && <span className={`small ${left < 0 ? 'text-crit' : 'muted'}`}>{left < 0 ? `Deadline passed ${-left}d ago` : left === 0 ? 'Due today' : `${left} days to ${fmt(target.deadline!)}`}</span>}
            <span className="avatars" aria-label={`${members.length} members`}>{members.slice(0, 5).map(m => <Avatar key={m.userId} user={m.user} size={24} />)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Icon name="edit" size={14} />Edit</button>
          </div>
        </div>
        <div className="page-actions">
          <Segmented<ViewKind> label="Board view" value={view} onChange={actions.setView} options={options} />
          {!readOnly && <button className="btn btn-primary" onClick={() => openTask('new', { projectId: target.id })}><Icon name="plus" size={16} />Add task</button>}
        </div>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} project={target} tags={tags} />
      <div className="view">
        {view === 'board' && <BoardView project={target} tasks={visible} readOnly={readOnly} manual={filter.sort === 'manual'} />}
        {view === 'list' && <ListView tasks={visible} projects={s.projects} readOnly={readOnly} />}
        {view === 'calendar' && <CalendarView tasks={visible} canCreate={!readOnly} projectId={target.id} />}
        {view === 'timeline' && <TimelineView tasks={visible} />}
      </div>
      {edit && <ProjectDialog project={target} onClose={() => setEdit(false)} />}
    </div>
  );
}
