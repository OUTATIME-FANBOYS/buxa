import { describe, expect, it } from 'vitest';
import { boardDndReducer, idleDnd, type BoardDnd, type BoardDndAction } from './boardDnd';

const run = (from: BoardDnd, ...actions: BoardDndAction[]) => actions.reduce(boardDndReducer, from);

describe('board drag state', () => {
  it('walks idle to task drag and back', () => {
    const s = run(idleDnd, { type: 'taskGrabbed', id: 't1' }, { type: 'taskOver', over: { columnId: 'c2', beforeId: null } });
    expect(s).toEqual({ mode: 'task', id: 't1', over: { columnId: 'c2', beforeId: null } });
    expect(run(s, { type: 'cleared' })).toEqual(idleDnd);
  });

  it('ignores a card slot update unless a card is being dragged', () => {
    expect(run(idleDnd, { type: 'taskOver', over: { columnId: 'c1', beforeId: null } })).toEqual(idleDnd);
    const col = run(idleDnd, { type: 'columnGrabbed', id: 'c1' });
    expect(run(col, { type: 'taskOver', over: { columnId: 'c1', beforeId: null } })).toBe(col);
  });

  it('tracks the target column and side during a column drag', () => {
    const s = run(idleDnd, { type: 'columnGrabbed', id: 'c1' }, { type: 'columnOver', over: { id: 'c2', side: 'r' } });
    expect(s).toEqual({ mode: 'column', id: 'c1', over: { id: 'c2', side: 'r' } });
  });

  it('does not target the column being dragged, and ignores repeated identical targets', () => {
    const s = run(idleDnd, { type: 'columnGrabbed', id: 'c1' });
    expect(run(s, { type: 'columnOver', over: { id: 'c1', side: 'l' } })).toBe(s);
    const t = run(s, { type: 'columnOver', over: { id: 'c2', side: 'l' } });
    expect(run(t, { type: 'columnOver', over: { id: 'c2', side: 'l' } })).toBe(t);
  });

  it('clears the target only when leaving that column', () => {
    const s = run(idleDnd, { type: 'columnGrabbed', id: 'c1' }, { type: 'columnOver', over: { id: 'c2', side: 'l' } });
    expect(run(s, { type: 'columnLeft', id: 'c3' })).toBe(s);
    expect(run(s, { type: 'columnLeft', id: 'c2' })).toEqual({ mode: 'column', id: 'c1', over: null });
  });

  it('ignores column events outside a column drag', () => {
    expect(run(idleDnd, { type: 'columnOver', over: { id: 'c2', side: 'l' } })).toEqual(idleDnd);
    const task = run(idleDnd, { type: 'taskGrabbed', id: 't1' });
    expect(run(task, { type: 'columnLeft', id: 'c2' })).toBe(task);
  });
});
