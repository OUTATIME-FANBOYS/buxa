import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Column, Project, Task } from '../types';
import { useStore } from '../state/store';
import { boardDndReducer, idleDnd } from '../state/boardDnd';
import { createDrag } from '../lib/cardDrag';
import { useUi } from '@/components/ui';

/**
 * Drag and drop for a board. Cards use pointer tracking (lib/cardDrag); columns keep native drag on desktop,
 * and every column also has Move left/right in its menu. The drag state is one reducer (state/boardDnd).
 */
export function useBoardDnd(project: Project, tasks: Task[], manual: boolean) {
  const { actions } = useStore(); const { toast } = useUi();
  const [dnd, dispatch] = useReducer(boardDndReducer, idleDnd);
  const scroller = useRef<HTMLDivElement>(null);

  const latest = useRef({ moveTask: actions.moveTask, tasks, manual, columns: project.columns, toast });
  latest.current = { moveTask: actions.moveTask, tasks, manual, columns: project.columns, toast };
  const [dragger] = useState(() => createDrag({
    root: () => scroller.current,
    setDrag: d => dispatch(d?.kind === 'task' ? { type: 'taskGrabbed', id: d.id } : { type: 'cleared' }),
    setOver: over => dispatch({ type: 'taskOver', over }),
    latest: () => latest.current,
  }));
  const grab = useCallback((e: React.PointerEvent<HTMLElement>, id: string) => dragger.grab(e, id), [dragger]);
  useEffect(() => {
    const block = (e: TouchEvent) => { if (dragger.active()) e.preventDefault(); };
    addEventListener('touchmove', block, { passive: false });
    return () => { removeEventListener('touchmove', block); dragger.destroy(); };
  }, [dragger]);

  const columnDrag = {
    start(e: React.DragEvent<HTMLElement>, col: Column) {
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', col.id); dispatch({ type: 'columnGrabbed', id: col.id });
    },
    end: () => dispatch({ type: 'cleared' }),
    over(e: React.DragEvent<HTMLElement>, col: Column) {
      if (dnd.mode !== 'column' || dnd.id === col.id) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      dispatch({ type: 'columnOver', over: { id: col.id, side: e.clientX < r.left + r.width / 2 ? 'l' : 'r' } });
    },
    drop(e: React.DragEvent<HTMLElement>, col: Column) {
      if (dnd.mode !== 'column' || !dnd.over) return;
      e.preventDefault();
      const i = project.columns.findIndex(c => c.id === col.id);
      actions.moveColumn(project.id, dnd.id, dnd.over.side === 'l' ? col.id : project.columns[i + 1]?.id ?? null);
      dispatch({ type: 'cleared' });
    },
    leave(e: React.DragEvent<HTMLElement>, col: Column) {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) dispatch({ type: 'columnLeft', id: col.id });
    },
  };
  return { dnd, scroller, grab, columnDrag };
}
