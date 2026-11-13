import type { AppState } from '../types';
import { AGENT_ID, buildSeed } from './seed';
import { simulateRun } from './agentSim';
import * as A from './agents';

/** The demo workspace plus a little agent history, so the inbox and audit trail aren't empty on first look. */
export function buildDemo(): AppState {
  let s: AppState = buildSeed();
  s = simulateRun(s, AGENT_ID, 'p-web').state;
  s = simulateRun(s, AGENT_ID, 'p-app').state;
  const maya: AppState = { ...s, session: { userId: 'u-maya' } };
  const pending = maya.proposals.filter(p => p.status === 'pending');
  let n = pending[0] ? A.decide(maya, pending[0].id, 'approve') : maya;
  if (pending[1]) n = A.decide(n, pending[1].id, 'reject');
  return { ...n, session: { userId: null } };
}
