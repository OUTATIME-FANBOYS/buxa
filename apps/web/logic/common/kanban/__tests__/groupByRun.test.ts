import { describe, expect, it } from 'vitest';
import type { Proposal } from '../types';
import { groupByRun } from '../groupByRun';

const p = (id: string, runId: string, at: string) => ({ id, runId, at }) as unknown as Proposal;

describe('groupByRun', () => {
  it('groups proposals by run, newest item first, with the first item time as the group time', () => {
    const groups = groupByRun([p('a', 'r1', 't1'), p('b', 'r2', 't2'), p('c', 'r1', 't3')]);
    expect(groups.map((g) => g.runId)).toEqual(['r1', 'r2']);
    expect(groups[0].items.map((x) => x.id)).toEqual(['c', 'a']);
    expect(groups[0].at).toBe('t1');
  });
  it('returns no groups for no proposals', () => {
    expect(groupByRun([])).toEqual([]);
  });
});
