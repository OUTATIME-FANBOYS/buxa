import type { AppState } from '../types';
import { AGENT_ID, PROJECT, USER, buildSeed } from './seed';
import { simulateRun } from './agentSim';
import * as A from './agents';

/** The demo camp plus a little agent history, so the inbox and audit trail aren't empty on first look. */
export function buildDemo(): AppState {
  let s: AppState = buildSeed();
  s = simulateRun(s, AGENT_ID, PROJECT.registration).state;
  s = simulateRun(s, AGENT_ID, PROJECT.facilities).state;
  const director: AppState = { ...s, session: { userId: USER.rosa } };
  const pending = director.proposals.filter(p => p.status === 'pending');
  let n = pending[0] ? A.decide(director, pending[0].id, 'approve') : director;
  if (pending[1]) n = A.decide(n, pending[1].id, 'reject');
  return { ...n, session: { userId: null } };
}
