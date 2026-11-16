import type { Column, Project, Task } from '../../types';
import type { BoardDnd } from '../../state/boardDnd';
import { useStore } from '../../state/store';
import { Icon, Menu } from '@/components/ui';
import type { useBoardDnd } from '../../hooks/useBoardDnd';
import { QuickAdd } from './QuickAdd';
import { TaskCard } from './TaskCard';

export interface BoardColumnProps {
  col: Column; index: number; project: Project; items: Task[]; readOnly: boolean; dnd: BoardDnd; adding: boolean;
  columnDrag: ReturnType<typeof useBoardDnd>['columnDrag']; onGrab: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  onAdd: () => void; onStopAdding: () => void; onEdit: () => void; onRemove: () => void;
}

export function BoardColumn({ col, index, project, items, readOnly, dnd, adding, columnDrag, onGrab, onAdd, onStopAdding, onEdit, onRemove }: BoardColumnProps) {
  const { actions } = useStore();
  const over = dnd.mode === 'task' && dnd.over?.columnId === col.id ? dnd.over : null;
  const colOver = dnd.mode === 'column' && dnd.over?.id === col.id ? dnd.over : null;
  const dragged = dnd.mode === 'column' && dnd.id === col.id;
  const last = project.columns.length - 1;
  return (
    <section data-col-id={col.id} className={`column ${colOver ? 'col-over-' + colOver.side : ''} ${dragged ? 'is-dragging' : ''} ${over ? 'is-target' : ''}`}
      aria-label={`${col.name}, ${items.length} tasks`} onDragOver={e => columnDrag.over(e, col)} onDrop={e => columnDrag.drop(e, col)} onDragLeave={e => columnDrag.leave(e, col)}>
      <header className="col-head" draggable={!readOnly} onDragStart={e => columnDrag.start(e, col)} onDragEnd={columnDrag.end}>
        {!readOnly && <span className="grip" aria-hidden="true"><Icon name="grip" size={14} /></span>}
        <i className={`kind-dot kind-${col.kind}`} aria-hidden="true" /><h2>{col.name}</h2><span className="count" aria-label={`${items.length} tasks`}>{items.length}</span>
        <span className="grow" />
        {!readOnly && <button className="icon-btn" aria-label={`Add task to ${col.name}`} onClick={onAdd}><Icon name="plus" /></button>}
        {!readOnly && <Menu label={`Column options for ${col.name}`} trigger={<Icon name="more" />} items={[
          { label: 'Edit column', icon: 'edit', onSelect: onEdit },
          { label: 'Move left', icon: 'arrowLeft', disabled: index === 0, onSelect: () => actions.moveColumn(project.id, col.id, project.columns[index - 1].id) },
          { label: 'Move right', icon: 'arrowRight', disabled: index === last, onSelect: () => actions.moveColumn(project.id, col.id, project.columns[index + 2]?.id ?? null) },
          { label: '', divider: true, onSelect() {} },
          { label: 'Delete column', icon: 'trash', danger: true, onSelect: onRemove },
        ]} />}
      </header>
      <div className="col-body">
        {items.map(t => (
          <div key={t.id} className="slot">
            {over?.beforeId === t.id && <div className="drop-line" />}
            <TaskCard task={t} project={project} readOnly={readOnly} dragging={dnd.mode === 'task' && dnd.id === t.id} onGrab={onGrab} />
          </div>
        ))}
        {over?.beforeId === null && <div className="drop-line" />}
        {items.length === 0 && !over && !adding && <div className="col-empty">{readOnly ? 'Nothing here' : 'Drop tasks here'}</div>}
        {adding && <QuickAdd project={project} column={col} onDone={onStopAdding} />}
      </div>
      {!readOnly && !adding && <button className="col-add" onClick={onAdd}><Icon name="plus" size={14} /> Add task</button>}
    </section>
  );
}
