import { beforeEach, describe, expect, it } from 'vitest';
import { AGENT_ID, buildSeed } from '../seed';
import * as G from '../gateway';
import * as A from '../agents';
import type { AppState } from '../../types';

let s: AppState;
const call = <T,>(r: G.Out<T>): T => { expect(r.error).toBeUndefined(); s = r.state; return r.value as T; };
const col = (name: string) => s.projects.find(p => p.id === 'p-web')!.columns.find(c => c.name === name)!.id;

beforeEach(() => { s = buildSeed(); });

describe('reads are limited to the agent’s scope', () => {
  it('lists only projects in scope and hides the rest as "not found"', () => {
    expect(G.listProjects(s, AGENT_ID).map(p => p.id).sort()).toEqual(['p-app', 'p-mkt', 'p-web']);
    s = A.updateAgent(s, AGENT_ID, { scope: ['p-web'] });
    expect(G.listProjects(s, AGENT_ID).map(p => p.id)).toEqual(['p-web']);
    expect(G.listTasks(s, AGENT_ID, { project: 'Mobile App v2' }).error).toMatch(/scope/);
    const appTask = s.tasks.find(t => t.projectId === 'p-app')!;
    expect(G.getTask(s, AGENT_ID, appTask.id).error).toMatch(/scope/);
    expect(G.comment(s, AGENT_ID, { taskId: appTask.id, body: 'hi', reason: 'x' }).error).toMatch(/scope/);
  });
  it('finds tasks by column name and text', () => {
    const rows = G.listTasks(s, AGENT_ID, { project: 'Website Relaunch', column: 'in progress' }).value as { column: string }[];
    expect(rows.length).toBeGreaterThan(0); expect(rows.every(r => r.column === 'In Progress')).toBe(true);
    expect((G.listTasks(s, AGENT_ID, { project: 'p-web', query: 'pricing' }).value as unknown[]).length).toBeGreaterThan(0);
  });
  it('describes the agent’s own permissions', () => {
    const w = G.whoami(s, AGENT_ID)!;
    expect(w.permissions).toMatchObject({ create_task: 'allowed', move_task: 'needs approval' }); expect(w.projects).toHaveLength(3);
  });
});

describe('writes become proposals, judged by policy', () => {
  it('creates a task immediately when allowed, using names rather than ids', () => {
    const o = call(G.createTask(s, AGENT_ID, { project: 'Website Relaunch', title: 'Audit alt text', column: 'to do', priority: 'high', assignee: 'Priya Raman', tags: ['A11y'], reason: 'Found missing alt text' }));
    expect(o.status).toBe('applied');
    const t = s.tasks.find(x => x.id === o.taskId)!;
    expect(t).toMatchObject({ title: 'Audit alt text', columnId: col('To Do'), priority: 'high', assigneeId: 'u-priya', tags: ['a11y'], createdBy: AGENT_ID });
  });
  it('queues a move that needs approval, then applies it when a person approves', () => {
    const o = call(G.moveTask(s, AGENT_ID, { taskId: 't-4', column: 'In Review', reason: 'Copy is ready' }));
    expect(o.status).toBe('pending'); expect(s.tasks.find(t => t.id === 't-4')!.columnId).not.toBe(col('In Review'));
    s = A.decide({ ...s, session: { userId: 'u-maya' } }, o.proposalId, 'approve');
    expect(s.tasks.find(t => t.id === 't-4')!.columnId).toBe(col('In Review'));
  });
  it('reports a blocked change with the reason', () => {
    s = A.setMoveRule(s, AGENT_ID, col('Done'), 'never');
    const o = call(G.moveTask(s, AGENT_ID, { taskId: 't-4', column: 'Done', reason: 'x' }));
    expect(o.status).toBe('blocked'); expect(o.note).toMatch(/policy/);
  });
  it('splits an edit into one proposal per field', () => {
    const outs = call(G.updateTask(s, AGENT_ID, { taskId: 't-4', title: 'New title', priority: 'critical', reason: 'clearer' }));
    expect(outs).toHaveLength(2); expect(outs.every(o => o.status === 'pending')).toBe(true);
  });
  it('groups close-together calls into one run and starts a new one after a gap', () => {
    call(G.comment(s, AGENT_ID, { taskId: 't-4', body: 'a', reason: 'r' })); call(G.comment(s, AGENT_ID, { taskId: 't-5', body: 'b', reason: 'r' }));
    expect(s.runs.filter(r => r.source === 'mcp')).toHaveLength(1);
    s = { ...s, proposals: s.proposals.map(p => ({ ...p, at: new Date(Date.now() - 3600_000).toISOString() })), runs: s.runs.map(r => ({ ...r, at: new Date(Date.now() - 3600_000).toISOString() })) };
    call(G.comment(s, AGENT_ID, { taskId: 't-6', body: 'c', reason: 'r' }));
    expect(s.runs.filter(r => r.source === 'mcp')).toHaveLength(2);
  });
  it('rejects bad input with a message the agent can act on', () => {
    expect(G.createTask(s, AGENT_ID, { project: 'p-web', title: '  ', reason: 'x' }).error).toMatch(/title/i);
    expect(G.createTask(s, AGENT_ID, { project: 'p-web', title: 'x', column: 'Nope', reason: 'x' }).error).toMatch(/Columns:/);
    expect(G.createTask(s, AGENT_ID, { project: 'p-web', title: 'x', due: 'tomorrow', reason: 'x' }).error).toMatch(/YYYY-MM-DD/);
    expect(G.createTask(s, AGENT_ID, { project: 'p-web', title: 'x'.repeat(300), reason: 'x' }).error).toMatch(/too long/);
    expect(G.comment(s, AGENT_ID, { taskId: 't-4', body: 'hi', reason: '' }).error).toMatch(/reason/i);
    expect(G.moveTask(s, AGENT_ID, { taskId: 't-4', column: 'Nope', reason: 'x' }).error).toMatch(/No column/);
  });
  it('never touches the board when paused', () => {
    s = A.updateAgent(s, AGENT_ID, { paused: true });
    expect(call(G.createTask(s, AGENT_ID, { project: 'p-web', title: 'x', reason: 'r' })).status).toBe('blocked');
  });
});

describe('review rights', () => {
  const R = 'u-agent-reviewer';
  beforeEach(() => {
    s = A.addAgent(s, 'w-nw', 'Reviewer', 'Claude', '', ['p-web']); const id = s.agents.at(-1)!.userId;
    s = { ...s, users: s.users.map(u => (u.id === id ? { ...u, id: R } : u)), agents: s.agents.map(a => (a.userId === id ? { ...a, userId: R } : a)) };
  });
  it('sees and decides only what it was granted', () => {
    const o = call(G.moveTask(s, AGENT_ID, { taskId: 't-4', column: 'In Review', reason: 'ready' }));
    expect(G.listToReview(s, R)).toHaveLength(0);
    expect(G.review(s, R, { proposalId: o.proposalId, verdict: 'approve' }).error).toMatch(/cannot review/);
    s = A.setApproves(s, R, ['move_task']);
    expect(G.listToReview(s, R).map(p => p.id)).toEqual([o.proposalId]);
    expect(call(G.review(s, R, { proposalId: o.proposalId, verdict: 'approve' })).status).toBe('approved');
  });
  it('cannot review its own proposals', () => {
    s = A.setApproves(s, R, ['move_task']); s = A.setTrust(s, R, 'move_task', 'approve');
    const o = call(G.moveTask(s, R, { taskId: 't-4', column: 'In Review', reason: 'x' }));
    expect(G.review(s, R, { proposalId: o.proposalId, verdict: 'approve' }).error).toBeDefined();
  });
});

describe('tasks created with only the required fields', () => {
  it('get every default, and stay searchable', () => {
    const o = call(G.createTask(s, AGENT_ID, { project: 'p-web', title: 'Bare minimum', reason: 'r' }));
    const t = s.tasks.find(x => x.id === o.taskId)!;
    expect(t).toMatchObject({ description: '', priority: 'medium', tags: [], subtasks: [], comments: [], archived: false });
    expect((G.listTasks(s, AGENT_ID, { project: 'p-web', query: 'minimum' }).value as unknown[]).length).toBe(1);
    expect((G.listTasks(s, AGENT_ID, { project: 'p-web', query: 'no-such-text' }).value as unknown[]).length).toBe(0);
  });
  it('are repaired when old data lacking defaults is loaded', async () => {
    const { repairData } = await import('../dataSlices');
    const broken = { ...s, tasks: [{ ...s.tasks[0], description: undefined, priority: undefined } as never, ...s.tasks.slice(1)] };
    const fixed = repairData(broken);
    expect(fixed.tasks[0]).toMatchObject({ description: '', priority: 'medium' }); expect(fixed.tasks[1]).toBe(s.tasks[1]);
    expect(repairData(s)).toBe(s); // untouched data keeps its identity
    expect((G.listTasks({ ...broken, ...fixed } as AppState, AGENT_ID, { project: 'p-web', query: 'x' }).error)).toBeUndefined();
  });
});
