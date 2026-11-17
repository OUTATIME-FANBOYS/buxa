import { describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../..';
import { buildSeed } from '../../..';
import { WORKSPACE } from '../../..';
import { dataActions } from '../data';

function harness() {
  const replace = vi.fn<(s: AppState) => void>();
  const actions = dataActions({ set: vi.fn(), get: () => buildSeed(), replace });
  return { actions, replace };
}

describe('resetDemo', () => {
  it('replaces the browser state once, with the camp sample only', () => {
    const { actions, replace } = harness();
    actions.resetDemo();
    expect(replace).toHaveBeenCalledTimes(1);
    const next = replace.mock.calls[0]?.[0];
    expect(next?.workspaces.map(w => w.id)).toEqual([WORKSPACE.camp]);
    expect(next?.tasks.length).toBeGreaterThan(0);
  });

  it('restores the same task sample every time', () => {
    const { actions, replace } = harness();
    actions.resetDemo();
    actions.resetDemo();
    const titles = replace.mock.calls.map(([s]) => s.tasks.map(t => t.title));
    expect(titles[0]).toEqual(titles[1]);
  });
});

describe('importData', () => {
  it('refuses a file that is not a Buxa export', () => {
    const { actions, replace } = harness();
    expect(actions.importData('{"hello":1}')).toMatch(/not a Buxa export/);
    expect(replace).not.toHaveBeenCalled();
  });
});
