import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../../../common';
import { createActions } from '../createActions';
import { fakeContext } from './fakeContext';

describe('createActions', () => {
  it('binds every action group to the one context', () => {
    const ctx = fakeContext(buildSeed());
    const actions = createActions(ctx);
    for (const name of ['setUi', 'setTheme', 'createTask', 'moveTask', 'createColumn', 'createProject', 'decide', 'simulateRun']) {
      expect(typeof (actions as Record<string, unknown>)[name]).toBe('function');
    }
    actions.setTheme('light');
    expect(ctx.get().ui.theme).toBe('light');
  });
});
