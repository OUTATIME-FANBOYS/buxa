import type { AppState } from '../types';
import { repairData } from '../lib/dataSlices';

/** Data saved before agents existed lacks their fields; fill them in rather than discard the user's work. */
export function normalize(s: AppState): AppState {
  const { acting: _drop, ...fixed } = repairData(s); void _drop;
  return {
    ...fixed,
    agents: (s.agents ?? []).map(a => ({ ...a, moveRules: a.moveRules ?? {}, approves: a.approves ?? [] })),
    runs: s.runs ?? [],
    proposals: s.proposals ?? [],
    ui: { ...s.ui, agentsEnabled: s.ui.agentsEnabled ?? false },
  };
}
