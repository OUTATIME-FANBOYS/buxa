import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../..';
import type { ActionContext } from '../context';
import { uiActions } from '../ui';

describe('ActionContext', () => {
  it('is the three operations every action group uses: set, get and replace', () => {
    let state = buildSeed();
    const ctx: ActionContext = {
      set: fn => {
        state = fn(state);
      },
      get: () => state,
      replace: s => {
        state = s;
      },
    };
    uiActions(ctx).setView('board');
    expect(ctx.get().ui.view).toBe('board');
    ctx.replace({ ...state, ui: { ...state.ui, view: 'list' } });
    expect(ctx.get().ui.view).toBe('list');
  });
});
