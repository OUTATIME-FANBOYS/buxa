import type { Proposal } from '../../types';

/** Proposals grouped by the run that made them. */
export function groupByRun(ps: Proposal[]) {
  const m = new Map<string, Proposal[]>(); ps.forEach(p => m.set(p.runId, [...(m.get(p.runId) ?? []), p]));
  return Array.from(m.entries()).map(([runId, items]) => ({ runId, items: items.slice().reverse(), at: items[0].at }));
}

