import { beforeEach, describe, expect, it } from 'vitest';
import { AGENT_ID, PROJECT, USER, WORKSPACE, buildSeed } from '../seed';
import * as D from '../domain';
import * as A from '../agents';
import { simulateRun } from '../agentSim';
import type { AppState, Change } from '../../types';

let s: AppState; let runId: string;
const as = (state: AppState, userId: string | null): AppState => ({ ...state, session: { userId } });
const proj = () => s.projects.find(p => p.id === PROJECT.registration)!;
const col = (name: string) => proj().columns.find(c => c.name === name)!.id;
const task = (id: string) => s.tasks.find(t => t.id === id)!;
const last = () => s.proposals[0];
const propose = (c: Change, reason = 'because') => { s = A.submit(s, AGENT_ID, runId, c, reason); return last(); };

beforeEach(() => {
  s = as(buildSeed(), USER.rosa);
  const r = A.startRun(s, AGENT_ID, 'test run'); s = r.state; runId = r.runId;
});

describe('trust policy', () => {
  it('applies an automatic change at once, as the agent, with provenance', () => {
    const p = propose({ kind: 'create_task', draft: { projectId: PROJECT.registration, columnId: col('Backlog'), title: 'Agent ticket' } }, 'found a gap');
    expect(p.status).toBe('applied');
    const t = s.tasks.find(x => x.title === 'Agent ticket')!;
    expect(t.createdBy).toBe(AGENT_ID);
    expect(t.history[0].via).toMatchObject({ runId, reason: 'found a gap' });
    expect(s.session.userId).toBe(USER.rosa); expect(s.acting).toBeUndefined();
  });
  it('queues a change that needs approval without touching the task', () => {
    const before = task('t-4').columnId;
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    expect(p.status).toBe('pending'); expect(task('t-4').columnId).toBe(before);
  });
  it('treats a move into a done column as "mark done", with its own trust level', () => {
    s = A.setTrust(s, AGENT_ID, 'move_task', 'auto');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') }).status).toBe('applied');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('Done') }).status).toBe('pending');
  });
  it('blocks work outside the agent’s project scope and while paused', () => {
    const outside = propose({ kind: 'create_task', draft: { projectId: 'p-me', columnId: proj().columns[0].id, title: 'x' } });
    expect(outside.status).toBe('blocked'); expect(outside.note).toMatch(/scope/);
    s = A.updateAgent(s, AGENT_ID, { paused: true });
    expect(propose({ kind: 'comment', taskId: 't-4', body: 'hi' }).status).toBe('blocked');
  });
  it('blocks a change when the policy says never', () => {
    s = A.setTrust(s, AGENT_ID, 'comment', 'never');
    expect(propose({ kind: 'comment', taskId: 't-4', body: 'hi' }).status).toBe('blocked');
  });
});

describe('deciding', () => {
  it('approving applies the change as the agent and records who approved', () => {
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    s = A.decide(s, p.id, 'approve');
    expect(task('t-4').columnId).toBe(col('In Review'));
    expect(task('t-4').history[0]).toMatchObject({ actorId: AGENT_ID, via: { proposalId: p.id } });
    expect(s.proposals.find(x => x.id === p.id)).toMatchObject({ status: 'approved', decidedBy: USER.rosa });
  });
  it('rejecting changes nothing on the board', () => {
    const tasks = s.tasks; const p = propose({ kind: 'update_task', taskId: 't-4', patch: { priority: 'critical' } });
    s = A.decide(s, p.id, 'reject');
    expect(s.tasks).toBe(tasks); expect(last().status).toBe('rejected');
  });
  it('refuses a stale approval when the task changed after the proposal', () => {
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    s = D.moveTask(s, 't-4', col('Done'), null);
    s = A.decide(s, p.id, 'approve');
    expect(s.proposals.find(x => x.id === p.id)).toMatchObject({ status: 'blocked', note: expect.stringMatching(/changed/) });
    expect(task('t-4').columnId).toBe(col('Done'));
  });
  it('lets only non-viewer members of the workspace decide, and never an agent', () => {
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    s = D.setRole(s, WORKSPACE.camp, USER.nia, 'viewer');
    expect(A.decide(as(s, USER.nia), p.id, 'approve').proposals.find(x => x.id === p.id)!.status).toBe('pending');
    expect(A.decide(as(s, AGENT_ID), p.id, 'approve').proposals.find(x => x.id === p.id)!.status).toBe('pending');
    expect(A.decide(as(s, USER.hannah), p.id, 'approve').proposals.find(x => x.id === p.id)!.status).toBe('approved');
  });
  it('cannot decide twice', () => {
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    s = A.decide(s, p.id, 'reject'); s = A.decide(s, p.id, 'approve');
    expect(task('t-4').columnId).not.toBe(col('In Review')); expect(last().status).toBe('rejected');
  });
});

describe('revertRun', () => {
  it('undoes created tasks, moves, edits and comments from one run', () => {
    s = A.setTrust(A.setTrust(s, AGENT_ID, 'move_task', 'auto'), AGENT_ID, 'update_task', 'auto');
    const orig = { col: task('t-4').columnId, prio: task('t-4').priority, comments: task('t-4').comments.length, count: s.tasks.length };
    propose({ kind: 'create_task', draft: { projectId: PROJECT.registration, columnId: col('Backlog'), title: 'Temp' } });
    propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') });
    propose({ kind: 'update_task', taskId: 't-4', patch: { priority: 'critical' } });
    propose({ kind: 'comment', taskId: 't-4', body: 'note' });
    const r = A.revertRun(s, runId); s = r.state;
    expect(r.reverted).toBe(4); expect(r.skipped).toBe(0);
    expect(task('t-4')).toMatchObject({ columnId: orig.col, priority: orig.prio }); expect(task('t-4').comments.length).toBe(orig.comments);
    expect(s.tasks.length).toBe(orig.count); expect(s.proposals.every(p => p.status === 'reverted')).toBe(true);
  });
  it('leaves alone anything a person has touched since', () => {
    s = A.setTrust(s, AGENT_ID, 'update_task', 'auto');
    propose({ kind: 'update_task', taskId: 't-4', patch: { priority: 'critical' } });
    propose({ kind: 'create_task', draft: { projectId: PROJECT.registration, columnId: col('Backlog'), title: 'Mine now' } });
    const id = s.tasks.find(t => t.title === 'Mine now')!.id;
    s = D.updateTask(s, 't-4', { priority: 'low' }); s = D.addComment(s, id, 'I am on it');
    const r = A.revertRun(s, runId);
    expect(r.reverted).toBe(0); expect(r.skipped).toBe(2);
    expect(r.state.tasks.some(t => t.id === id)).toBe(true); expect(r.state.tasks.find(t => t.id === 't-4')!.priority).toBe('low');
    expect(r.state.proposals.every(p => p.status === 'applied' && /Not reverted/.test(p.note ?? ''))).toBe(true);
  });
});

describe('simulated agent', () => {
  it('goes through the same policy and is safe to re-run', () => {
    const first = simulateRun(s, AGENT_ID, PROJECT.registration); s = first.state;
    expect(first.count).toBeGreaterThan(0);
    expect(s.proposals.every(p => p.status === 'applied' || p.status === 'pending')).toBe(true);
    const again = simulateRun(s, AGENT_ID, PROJECT.registration);
    expect(again.count).toBe(0);
  });
});

describe('ordinary board use is unaffected', () => {
  it('a person’s own changes carry no provenance', () => {
    s = D.moveTask(s, 't-4', col('In Review'), null);
    expect(task('t-4').history[0].via).toBeUndefined(); expect(s.proposals).toHaveLength(0);
  });
  it('stats count outcomes', () => {
    const p = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') }); s = A.decide(s, p.id, 'approve');
    const q = propose({ kind: 'update_task', taskId: 't-5', patch: { priority: 'low' } }); s = A.decide(s, q.id, 'reject');
    expect(A.agentStats(s)).toMatchObject({ approved: 1, rejected: 1, acceptance: 0.5, pending: 0 });
  });
});

describe('older saved data', () => {
  it('loads state saved before agents existed, with agents switched off', async () => {
    const { normalize } = await import('../../state/normalize');
    const { agents: _a, runs: _r, proposals: _p, ...old } = buildSeed(); void _a; void _r; void _p;
    const legacy = { ...old, ui: { ...old.ui, agentsEnabled: undefined } } as unknown as AppState;
    const n = normalize(legacy);
    expect(n.agents).toEqual([]); expect(n.proposals).toEqual([]); expect(n.ui.agentsEnabled).toBe(false);
    expect(n.tasks).toBe(legacy.tasks);
  });
});

describe('stage rules', () => {
  it('a rule for the destination stage overrides the general move policy', () => {
    s = A.setTrust(s, AGENT_ID, 'move_task', 'approve');
    s = A.setMoveRule(s, AGENT_ID, col('In Progress'), 'auto');
    s = A.setMoveRule(s, AGENT_ID, col('In Review'), 'never');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Progress') }).status).toBe('applied');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') }).status).toBe('blocked');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('To Do') }).status).toBe('pending'); // no rule: general policy
  });
  it('a stage rule can let an agent finish work on its own, and clearing it restores the default', () => {
    s = A.setMoveRule(s, AGENT_ID, col('Done'), 'auto');
    expect(propose({ kind: 'move_task', taskId: 't-4', columnId: col('Done') }).status).toBe('applied');
    s = A.setMoveRule(s, AGENT_ID, col('Done'), null);
    expect(s.agents[0].moveRules).toEqual({});
    expect(propose({ kind: 'move_task', taskId: 't-5', columnId: col('Done') }).status).toBe('pending');
  });
});

describe('agents approving agents', () => {
  const REVIEWER = 'u-agent-reviewer';
  let pid: string;
  beforeEach(() => {
    s = A.addAgent(s, WORKSPACE.camp, 'Reviewer', 'Claude', '', [PROJECT.registration]);
    const rid = s.agents.at(-1)!.userId;
    s = { ...s, users: s.users.map(u => (u.id === rid ? { ...u, id: REVIEWER } : u)), agents: s.agents.map(a => (a.userId === rid ? { ...a, userId: REVIEWER } : a)) };
    pid = propose({ kind: 'move_task', taskId: 't-4', columnId: col('In Review') }).id;
  });
  it('cannot approve anything by default', () => {
    s = A.decideAs(s, REVIEWER, pid, 'approve');
    expect(s.proposals.find(p => p.id === pid)!.status).toBe('pending');
  });
  it('can approve only the kinds it was granted, and the decision is attributed to it', () => {
    s = A.setApproves(s, REVIEWER, ['move_task']);
    s = A.decideAs(s, REVIEWER, pid, 'approve');
    expect(s.proposals.find(p => p.id === pid)).toMatchObject({ status: 'approved', decidedBy: REVIEWER });
    expect(s.session.userId).toBe(USER.rosa);
    const q = propose({ kind: 'move_task', taskId: 't-5', columnId: col('Done') }); // "mark done" was not granted
    expect(A.decideAs(s, REVIEWER, q.id, 'approve').proposals.find(p => p.id === q.id)!.status).toBe('pending');
  });
  it('never approves its own work, outside its projects, or while paused', () => {
    s = A.setApproves(s, REVIEWER, ['move_task', 'complete_task', 'create_task', 'comment', 'update_task']);
    s = A.setApproves(s, AGENT_ID, ['move_task']);
    expect(A.decideAs(s, AGENT_ID, pid, 'approve').proposals.find(p => p.id === pid)!.status).toBe('pending'); // own
    s = A.updateAgent(s, REVIEWER, { paused: true });
    expect(A.decideAs(s, REVIEWER, pid, 'approve').proposals.find(p => p.id === pid)!.status).toBe('pending'); // paused
    s = A.updateAgent(s, REVIEWER, { paused: false, scope: [PROJECT.facilities] });
    expect(A.decideAs(s, REVIEWER, pid, 'approve').proposals.find(p => p.id === pid)!.status).toBe('pending'); // other project
  });
  it('cannot revert runs: reverting is for people', () => {
    s = A.setTrust(s, AGENT_ID, 'comment', 'auto'); propose({ kind: 'comment', taskId: 't-4', body: 'x' });
    const r = A.revertRun({ ...s, session: { userId: REVIEWER } }, runId);
    expect(r.reverted).toBe(0);
  });
});
