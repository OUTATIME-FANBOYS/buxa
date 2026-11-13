import { useState } from 'react';
import type { Column, Project, Task } from '../../types';
import { useStore } from '../../state/store';
import { Icon, useUi } from '@/components/ui';
import { useBoardDnd } from '../../hooks/useBoardDnd';
import { ColumnDialog } from '../dialogs/ColumnDialog';
import { BoardColumn } from './BoardColumn';

export function BoardView({ project, tasks, readOnly, manual }: { project: Project; tasks: Task[]; readOnly: boolean; manual: boolean }) {
  const { actions } = useStore(); const { confirm, toast } = useUi();
  const { dnd, scroller, grab, columnDrag } = useBoardDnd(project, tasks, manual);
  const [adding, setAdding] = useState<string | null>(null);
  const [colDlg, setColDlg] = useState<{ column?: Column } | null>(null);

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
      {project.columns.map((col, i) => (
        <BoardColumn key={col.id} col={col} index={i} project={project} items={tasks.filter(t => t.columnId === col.id)} readOnly={readOnly} dnd={dnd}
          adding={adding === col.id} columnDrag={columnDrag} onGrab={grab} onAdd={() => setAdding(col.id)} onStopAdding={() => setAdding(null)}
          onEdit={() => setColDlg({ column: col })} onRemove={() => removeColumn(col)} />
      ))}
      {!readOnly && <button className="add-column" onClick={() => setColDlg({})}><Icon name="plus" size={16} /> Add column</button>}
      {colDlg && <ColumnDialog projectId={project.id} column={colDlg.column} onClose={() => setColDlg(null)} />}
    </div>
  );
}
