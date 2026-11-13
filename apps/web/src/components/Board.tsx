import { memo, useEffect, useRef, useState } from 'react';
import type { Column, Project, Task } from '../types';
import { useStore } from '../store';
import { Icon } from './Icon';
import { Avatar, Menu, PriorityMark, useUi } from './ui';
import { dueInfo, subtaskProgress } from '../lib/tasks';
import { ColumnDialog } from './dialogs';
import { taskMenuItems, useTaskCommands } from './taskCommands';
import { createDrag, justDragged, type Drag, type Over } from '../lib/cardDrag';


export const DueChip = ({ due, kind }: { due?: string; kind: 'open' | 'active' | 'done' }) => {
  const d = dueInfo(due, kind); if (!d) return null;
  return <span className={`due due-${d.tone}`}><Icon name={d.tone === 'done' ? 'check' : 'clock'} size={12} />{d.label}</span>;
};

/* ---------- Card ---------- */
const Card = memo(function Card({ task, project, readOnly, dragging, onGrab }: {
  task: Task; project: Project; readOnly: boolean; dragging: boolean; onGrab: (e: React.PointerEvent<HTMLElement>, id: string) => void;
}) {
  const { userById, kindOf } = useStore(); const { openTask } = useUi(); const cmd = useTaskCommands();
  const kind = kindOf(task); const sp = subtaskProgress(task); const user = userById(task.assigneeId);
  const idx = project.columns.findIndex(c => c.id === task.columnId);
  const move = (to: number) => { const c = project.columns[to]; if (c && !readOnly) cmd.moveTo(task, c); };
  return (
    <article className={`card ${dragging ? 'is-dragging' : ''} ${task.archived ? 'is-archived' : ''}`} data-card-id={task.id} tabIndex={0}
      onPointerDown={e => { if (readOnly || (e.target as HTMLElement).closest('button,a,input,select,textarea')) return; onGrab(e, task.id); }}
      onClick={() => { if (!justDragged()) openTask(task.id); }}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') openTask(task.id);
        if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); move(idx - 1); }
        if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); move(idx + 1); }
      }}
      aria-label={`${task.title}. ${project.columns[idx]?.name}. ${task.priority} priority.${user ? ' Assigned to ' + user.name + '.' : ''}`}>
      <div className="card-top">
        <h3>{task.title}</h3>
        <Menu label={`Actions for ${task.title}`} className="icon-btn card-menu" trigger={<Icon name="more" />} items={taskMenuItems(task, project, readOnly, cmd)} />
      </div>
      {task.tags.length > 0 && <div className="tags">{task.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}{task.tags.length > 3 && <span className="tag">+{task.tags.length - 3}</span>}</div>}
      <div className="card-meta">
        <PriorityMark priority={task.priority} />
        <DueChip due={task.due} kind={kind} />
        {sp.total > 0 && <span className="meta" title="Subtasks"><Icon name="check" size={12} />{sp.done}/{sp.total}</span>}
        {task.comments.length > 0 && <span className="meta" title="Comments"><Icon name="message" size={12} />{task.comments.length}</span>}
        {task.attachments.length > 0 && <span className="meta" title="Attachments"><Icon name="clip" size={12} />{task.attachments.length}</span>}
        <span className="grow" />
        {task.archived && <span className="tag">Archived</span>}
        <Avatar user={user} size={22} />
      </div>
    </article>
  );
});

function QuickAdd({ project, column, onDone }: { project: Project; column: Column; onDone: () => void }) {
  const { actions, me } = useStore(); const [v, setV] = useState(''); const [err, setErr] = useState('');
  const submit = () => {
    const t = v.trim(); if (!t) return setErr('Add a title first.'); if (t.length > 140) return setErr('Keep titles under 140 characters.');
    actions.createTask({ projectId: project.id, columnId: column.id, title: t, assigneeId: me?.id }); setV(''); setErr('');
  };
  return (
    <div className="quick-add">
      <textarea autoFocus rows={2} value={v} placeholder="What needs doing?" aria-label={`New task in ${column.name}`} aria-invalid={!!err}
        onChange={e => { setV(e.target.value); setErr(''); }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); onDone(); } }} />
      {err && <span className="field-error" role="alert">{err}</span>}
      <div className="row"><button className="btn btn-primary btn-sm" onClick={submit}>Add</button><button className="btn btn-ghost btn-sm" onClick={onDone}>Done</button><span className="muted small grow" style={{ textAlign: 'right' }}>Enter to add</span></div>
    </div>
  );
}

export function BoardView({ project, tasks, readOnly, manual }: { project: Project; tasks: Task[]; readOnly: boolean; manual: boolean }) {
  const { actions } = useStore(); const { confirm, toast } = useUi();
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [colOver, setColOver] = useState<{ id: string; side: 'l' | 'r' } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [colDlg, setColDlg] = useState<{ column?: Column } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const latest = useRef({ moveTask: actions.moveTask, tasks, manual, columns: project.columns, toast });
  latest.current = { moveTask: actions.moveTask, tasks, manual, columns: project.columns, toast };
  const dragger = useRef<ReturnType<typeof createDrag>>();
  if (!dragger.current) dragger.current = createDrag({ root: () => scroller.current, setDrag, setOver, latest: () => latest.current });
  const grab = useRef((e: React.PointerEvent<HTMLElement>, id: string) => dragger.current!.grab(e, id)).current;
  useEffect(() => {
    const block = (e: TouchEvent) => { if (dragger.current!.active()) e.preventDefault(); };
    addEventListener('touchmove', block, { passive: false });
    return () => { removeEventListener('touchmove', block); dragger.current!.destroy(); };
  }, []);

  // Column reordering keeps native drag (desktop); every column also has Move left/right in its menu.
  const clearCol = () => { setDrag(null); setColOver(null); };
  const onColOver = (e: React.DragEvent<HTMLElement>, col: Column) => {
    if (drag?.kind !== 'column' || drag.id === col.id) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect(); const side = e.clientX < r.left + r.width / 2 ? 'l' : 'r';
    if (colOver?.id !== col.id || colOver.side !== side) setColOver({ id: col.id, side });
  };
  const onColDrop = (e: React.DragEvent<HTMLElement>, col: Column) => {
    if (drag?.kind !== 'column' || !colOver) return; e.preventDefault();
    const i = project.columns.findIndex(c => c.id === col.id);
    actions.moveColumn(project.id, drag.id, colOver.side === 'l' ? col.id : project.columns[i + 1]?.id ?? null); clearCol();
  };
  const removeColumn = async (col: Column) => {
    const others = project.columns.filter(c => c.id !== col.id);
    if (!others.length) return toast('A board needs at least one column.', { tone: 'error' });
    const n = tasks.filter(t => t.columnId === col.id).length;
    if (await confirm({ title: `Delete “${col.name}”?`, body: n ? `Its ${n} task${n === 1 ? '' : 's'} will move to “${others[0].name}”.` : 'This column is empty.', confirmLabel: 'Delete column', danger: true })) {
      actions.deleteColumn(project.id, col.id, others[0].id);
    }
  };

  return (
    <div className="board" ref={scroller}>
      {project.columns.map((col, ci) => {
        const items = tasks.filter(t => t.columnId === col.id);
        const showLine = drag?.kind === 'task' && over?.columnId === col.id;
        return (
          <section key={col.id} data-col-id={col.id} className={`column ${colOver?.id === col.id ? 'col-over-' + colOver.side : ''} ${drag?.kind === 'column' && drag.id === col.id ? 'is-dragging' : ''} ${showLine ? 'is-target' : ''}`}
            aria-label={`${col.name}, ${items.length} tasks`} onDragOver={e => onColOver(e, col)} onDrop={e => onColDrop(e, col)}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setColOver(o => (o?.id === col.id ? null : o)); }}>
            <header className="col-head" draggable={!readOnly}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', col.id); setDrag({ kind: 'column', id: col.id }); }} onDragEnd={clearCol}>
              {!readOnly && <span className="grip" aria-hidden="true"><Icon name="grip" size={14} /></span>}
              <i className={`kind-dot kind-${col.kind}`} aria-hidden="true" /><h2>{col.name}</h2><span className="count" aria-label={`${items.length} tasks`}>{items.length}</span>
              <span className="grow" />
              {!readOnly && <button className="icon-btn" aria-label={`Add task to ${col.name}`} onClick={() => setAdding(col.id)}><Icon name="plus" /></button>}
              {!readOnly && <Menu label={`Column options for ${col.name}`} trigger={<Icon name="more" />} items={[
                { label: 'Edit column', icon: 'edit', onSelect: () => setColDlg({ column: col }) },
                { label: 'Move left', icon: 'arrowLeft', disabled: ci === 0, onSelect: () => actions.moveColumn(project.id, col.id, project.columns[ci - 1].id) },
                { label: 'Move right', icon: 'arrowRight', disabled: ci === project.columns.length - 1, onSelect: () => actions.moveColumn(project.id, col.id, project.columns[ci + 2]?.id ?? null) },
                { label: '', divider: true, onSelect() {} },
                { label: 'Delete column', icon: 'trash', danger: true, onSelect: () => removeColumn(col) },
              ]} />}
            </header>
            <div className="col-body">
              {items.map(t => (
                <div key={t.id} className="slot">
                  {showLine && over!.beforeId === t.id && <div className="drop-line" />}
                  <Card task={t} project={project} readOnly={readOnly} dragging={drag?.kind === 'task' && drag.id === t.id} onGrab={grab} />
                </div>
              ))}
              {showLine && over!.beforeId === null && <div className="drop-line" />}
              {items.length === 0 && !showLine && adding !== col.id && <div className="col-empty">{readOnly ? 'Nothing here' : 'Drop tasks here'}</div>}
              {adding === col.id && <QuickAdd project={project} column={col} onDone={() => setAdding(null)} />}
            </div>
            {!readOnly && adding !== col.id && <button className="col-add" onClick={() => setAdding(col.id)}><Icon name="plus" size={14} /> Add task</button>}
          </section>
        );
      })}
      {!readOnly && <button className="add-column" onClick={() => setColDlg({})}><Icon name="plus" size={16} /> Add column</button>}
      {colDlg && <ColumnDialog projectId={project.id} column={colDlg.column} onClose={() => setColDlg(null)} />}
    </div>
  );
}
