import type { Over } from '../lib/cardDrag';

/** Which side of a column a dragged column would land on. */
export type ColumnOver = { id: string; side: 'l' | 'r' };

/**
 * What the board is doing with the pointer. A card drag tracks the drop slot, a column drag tracks the target column;
 * the two never mix, which a union says and three separate flags could not.
 */
export type BoardDnd =
  | { mode: 'idle' }
  | { mode: 'task'; id: string; over: Over | null }
  | { mode: 'column'; id: string; over: ColumnOver | null };

export type BoardDndAction =
  | { type: 'taskGrabbed'; id: string }
  | { type: 'taskOver'; over: Over | null }
  | { type: 'columnGrabbed'; id: string }
  | { type: 'columnOver'; over: ColumnOver }
  | { type: 'columnLeft'; id: string }
  | { type: 'cleared' };

export const idleDnd: BoardDnd = { mode: 'idle' };

/** Events that do not fit the current mode (a stray "over" after the drop) are ignored. */
export function boardDndReducer(s: BoardDnd, a: BoardDndAction): BoardDnd {
  switch (a.type) {
    case 'taskGrabbed': return { mode: 'task', id: a.id, over: null };
    case 'columnGrabbed': return { mode: 'column', id: a.id, over: null };
    case 'cleared': return idleDnd;
    case 'taskOver': return s.mode === 'task' ? { ...s, over: a.over } : s;
    case 'columnOver': {
      if (s.mode !== 'column' || s.id === a.over.id) return s;
      return s.over?.id === a.over.id && s.over.side === a.over.side ? s : { ...s, over: a.over };
    }
    case 'columnLeft': return s.mode === 'column' && s.over?.id === a.id ? { ...s, over: null } : s;
  }
}
