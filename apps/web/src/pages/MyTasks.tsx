import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Empty, Segmented } from '../components/ui';
import { ListView } from '../components/Views';
import { Icon } from '../components/Icon';
import { diffDays, today } from '../lib/dates';
import type { Task } from '../types';

export function MyTasks() {
  const { s, me, wsTasks, kindOf, projects, readOnly } = useStore();
  const [q, setQ] = useState(''); const [show, setShow] = useState<'open' | 'done' | 'all'>('open');
  const mine = useMemo(() => wsTasks.filter(t => t.assigneeId === me?.id && !t.archived && (!q || t.title.toLowerCase().includes(q.toLowerCase()))), [wsTasks, me, q]);
  const open = mine.filter(t => kindOf(t) !== 'done'); const done = mine.filter(t => kindOf(t) === 'done');
  const groups: { name: string; tasks: Task[] }[] = [
    { name: 'Overdue', tasks: open.filter(t => t.due && diffDays(t.due, today()) < 0) },
    { name: 'Today', tasks: open.filter(t => t.due && diffDays(t.due, today()) === 0) },
    { name: 'This week', tasks: open.filter(t => t.due && diffDays(t.due, today()) > 0 && diffDays(t.due, today()) <= 7) },
    { name: 'Later', tasks: open.filter(t => t.due && diffDays(t.due, today()) > 7) },
    { name: 'No date', tasks: open.filter(t => !t.due) },
  ];
  void s;
  return (
    <div className="page">
      <header className="page-head"><div className="page-title"><h1>My tasks</h1><p className="muted">{open.length} open · {done.length} done</p></div>
        <div className="page-actions"><div className="search-local"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search my tasks" aria-label="Search my tasks" /></div>
          <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]} /></div></header>
      {mine.length === 0 ? <Empty icon="tasks" title={q ? 'No matching tasks' : 'No tasks assigned to you'} body={q ? 'Try a different search.' : 'Tasks assigned to you across every project will show up here.'} /> : (
        <>
          {show !== 'done' && groups.filter(g => g.tasks.length).map(g => (
            <section key={g.name} className="group"><h2 className={`group-title ${g.name === 'Overdue' ? 'text-crit' : ''}`}>{g.name} <span className="count">{g.tasks.length}</span></h2>
              <ListView tasks={g.tasks} projects={projects} readOnly={readOnly} showProject /></section>))}
          {show !== 'open' && done.length > 0 && <section className="group"><h2 className="group-title">Completed <span className="count">{done.length}</span></h2><ListView tasks={done} projects={projects} readOnly={readOnly} showProject /></section>}
          {show === 'open' && open.length === 0 && <Empty icon="check" title="All clear" body="You have no open tasks. Enjoy it." />}
        </>
      )}
    </div>
  );
}
