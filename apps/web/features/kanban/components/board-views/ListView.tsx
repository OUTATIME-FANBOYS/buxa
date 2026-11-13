import { PriorityMark } from '../PriorityMark';
import { useMemo, useState } from 'react';
import type { Project, Task } from '../../types';
import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { Avatar, Empty, Icon, KIND_TONE, Pill } from '@/components/ui';
import { DueChip } from '../board/DueChip';
import { PRIORITY_RANK, subtaskProgress } from '../../lib/tasks';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'due';
/** No sort yet (`null`), or one column in one direction: the two can only be set together. */
type Sort = { key: SortKey; dir: 1 | -1 } | null;

export function ListView({ tasks, projects, readOnly, showProject = false }: { tasks: Task[]; projects: Project[]; readOnly: boolean; showProject?: boolean }) {
  const { actions, userById, kindOf } = useStore(); const { openTask } = useTaskDrawer();
  const [sort, setSort] = useState<Sort>(null);
  const colName = (t: Task) => projects.find(p => p.id === t.projectId)?.columns.find(c => c.id === t.columnId)?.name ?? '';
  const rows = useMemo(() => {
    if (!sort) return tasks;
    const { key, dir } = sort;
    const val = (t: Task): string | number => key === 'title' ? t.title.toLowerCase() : key === 'status' ? colName(t) : key === 'priority' ? PRIORITY_RANK[t.priority] : key === 'assignee' ? userById(t.assigneeId)?.name ?? '~' : t.due ?? '9999';
    return [...tasks].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sort]);
  const toggleSort = (k: SortKey) => setSort(s => (s?.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }));
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort?.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => toggleSort(k)}>{label}{sort?.key === k && <Icon name="down" size={12} className={sort.dir === 1 ? '' : 'flip'} />}</button>
    </th>
  );
  if (!rows.length) return <Empty icon="search" title="No tasks to show" body="Try clearing a filter or add a new task." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th className="c-check"><span className="sr-only">Complete</span></th>{th('title', 'Task')}{th('status', 'Status', 'c-status')}{th('priority', 'Priority', 'c-prio')}{th('assignee', 'Assignee', 'c-who')}{th('due', 'Due', 'c-due')}</tr></thead>
        <tbody>
          {rows.map(t => {
            const kind = kindOf(t); const proj = projects.find(p => p.id === t.projectId); const sp = subtaskProgress(t);
            if (!proj) return null;
            const done = proj.columns.find(c => c.kind === 'done'); const first = proj.columns.find(c => c.kind === 'open') ?? proj.columns[0];
            return (
              <tr key={t.id} className={t.archived ? 'is-archived' : ''}>
                <td className="c-check"><input type="checkbox" checked={kind === 'done'} disabled={readOnly || !done} aria-label={`Mark “${t.title}” ${kind === 'done' ? 'not done' : 'done'}`}
                  onChange={() => { const to = kind === 'done' ? first : done; if (to) actions.moveTask(t.id, to.id, null); }} /></td>
                <td><button className="row-title" onClick={() => openTask(t.id)}>{t.title}</button>
                  <div className="row-sub">{showProject && <span className="muted small">{proj.name}</span>}{t.tags.slice(0, 3).map(g => <span key={g} className="tag">{g}</span>)}{sp.total > 0 && <span className="meta"><Icon name="check" size={12} />{sp.done}/{sp.total}</span>}</div></td>
                <td className="c-status"><Pill tone={KIND_TONE[kind]}>{colName(t)}</Pill></td>
                <td className="c-prio"><PriorityMark priority={t.priority} label /></td>
                <td className="c-who"><span className="who"><Avatar user={userById(t.assigneeId)} size={22} /><span>{userById(t.assigneeId)?.name ?? 'Unassigned'}</span></span></td>
                <td className="c-due"><DueChip due={t.due} kind={kind} />{!t.due && <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
