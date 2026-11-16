/**
 * The agent gateway: everything an external agent (over MCP or HTTP) is allowed to ask for, as pure functions.
 *
 * Every function takes the identity of the calling agent from the caller, never from the request, so an agent
 * cannot act as anyone else. Reads are limited to the projects in the agent's scope; anything outside it is
 * reported as "not found" rather than "forbidden", so scope boundaries don't leak. Writes never touch the board
 * directly: they become proposals and go through `agents.submit`, so the trust policy always has the last word.
 *
 * Task text is data written by people (and other agents). It is returned as data and must never be read as instructions.
 */
import type { AppState, Change, Priority, Proposal, ProposalStatus, Task } from '../types';
import * as A from './agents';
import { PRIORITIES } from './tasks';

export type Out<T> = { state: AppState; value?: T; error?: string };
const fail = (state: AppState, error: string): Out<never> => ({ state, error });

export const LIMITS = { title: 200, description: 5000, body: 2000, reason: 300, tag: 30, tags: 10, results: 100 };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RUN_GAP_MS = 10 * 60 * 1000;

/* ---------- lookups ---------- */
const agent = (s: AppState, id: string) => s.agents.find(a => a.userId === id);
const inScope = (s: AppState, agentId: string, projectId?: string) => !!projectId && !!agent(s, agentId)?.scope.includes(projectId);
const visibleTask = (s: AppState, agentId: string, taskId: string): Task | undefined => {
  const t = s.tasks.find(x => x.id === taskId);
  return t && inScope(s, agentId, t.projectId) ? t : undefined;
};
const project = (s: AppState, agentId: string, ref: string) => {
  const r = ref.trim().toLowerCase();
  return s.projects.find(p => inScope(s, agentId, p.id) && (p.id.toLowerCase() === r || p.name.toLowerCase() === r));
};
const columnOf = (p: { columns: { id: string; name: string }[] }, ref: string) => {
  const r = ref.trim().toLowerCase(); return p.columns.find(c => c.id.toLowerCase() === r || c.name.toLowerCase() === r);
};
const userRef = (s: AppState, workspaceId: string, ref: string) => {
  const r = ref.trim().toLowerCase(); const members = s.workspaces.find(w => w.id === workspaceId)?.members ?? [];
  return s.users.find(u => members.some(m => m.userId === u.id) && (u.id.toLowerCase() === r || u.name.toLowerCase() === r || u.email.toLowerCase() === r));
};
const nameOf = (s: AppState, id?: string) => (id ? s.users.find(u => u.id === id)?.name : undefined);
const clip = (text: string, n: number) => (text.length > n ? text.slice(0, n) + '…' : text);

/* ---------- views ---------- */
const taskView = (s: AppState, t: Task) => {
  const p = s.projects.find(x => x.id === t.projectId);
  return { id: t.id, title: t.title, project: p?.name, column: p?.columns.find(c => c.id === t.columnId)?.name, priority: t.priority,
    assignee: nameOf(s, t.assigneeId) ?? null, due: t.due ?? null, start: t.start ?? null, tags: t.tags, createdBy: nameOf(s, t.createdBy) ?? null,
    subtasks: { done: t.subtasks.filter(x => x.done).length, total: t.subtasks.length } };
};
const proposalView = (s: AppState, p: Proposal) => {
  const d = A.describe(s, p.change, p.undo);
  return { id: p.id, run: s.runs.find(r => r.id === p.runId)?.label, action: d.text, reason: p.reason, status: p.status, note: p.note ?? null,
    proposedAt: p.at, decidedBy: nameOf(s, p.decidedBy) ?? null, decidedAt: p.decidedAt ?? null, taskId: p.taskId ?? null };
};
const outcome = (s: AppState, p: Proposal) => ({ proposalId: p.id, status: p.status as ProposalStatus, note: p.note ?? null, taskId: p.taskId ?? null,
  meaning: p.status === 'applied' ? 'Done. The change was applied immediately.' : p.status === 'pending' ? 'Waiting for a person (or an agent with review rights) to approve it. Do not repeat it.' : p.status === 'blocked' ? 'Refused by this agent’s permissions. Do not retry the same change.' : p.status });

/* ---------- reads ---------- */
export function whoami(s: AppState, agentId: string) {
  const a = agent(s, agentId); if (!a) return null;
  const colNames = (pid: string) => s.projects.find(p => p.id === pid)?.columns ?? [];
  return {
    name: nameOf(s, agentId), model: a.model, purpose: a.purpose, paused: a.paused,
    projects: a.scope.map(id => s.projects.find(p => p.id === id)).filter(Boolean).map(p => ({ id: p!.id, name: p!.name })),
    permissions: Object.fromEntries(A.PROPOSAL_KINDS.map(k => [k, a.trust[k] === 'auto' ? 'allowed' : a.trust[k] === 'approve' ? 'needs approval' : 'blocked'])),
    stageRules: Object.fromEntries(Object.entries(a.moveRules).map(([colId, lvl]) => {
      const col = a.scope.flatMap(colNames).find(c => c.id === colId); return [col?.name ?? colId, lvl === 'auto' ? 'allowed' : lvl === 'approve' ? 'needs approval' : 'blocked'];
    })),
    mayReview: a.approves,
  };
}

export const listProjects = (s: AppState, agentId: string) =>
  s.projects.filter(p => inScope(s, agentId, p.id)).map(p => ({ id: p.id, name: p.name, description: p.description, deadline: p.deadline ?? null, columns: p.columns.map(c => ({ id: c.id, name: c.name, kind: c.kind })) }));

export function listTasks(s: AppState, agentId: string, q: { project: string; column?: string; query?: string; assignee?: string; limit?: number }): Out<unknown[]> {
  const p = project(s, agentId, q.project); if (!p) return fail(s, 'No such project in your scope. Call list_projects to see what you can use.');
  let col: string | undefined; if (q.column) { const c = columnOf(p, q.column); if (!c) return fail(s, `No column “${q.column}” in ${p.name}. Columns: ${p.columns.map(x => x.name).join(', ')}.`); col = c.id; }
  const text = q.query?.trim().toLowerCase(); const who = q.assignee ? userRef(s, p.workspaceId, q.assignee)?.id : undefined;
  if (q.assignee && !who) return fail(s, `No member matches “${q.assignee}”.`);
  const rows = s.tasks.filter(t => t.projectId === p.id && !t.archived && (!col || t.columnId === col) && (!who || t.assigneeId === who)
    && (!text || t.title.toLowerCase().includes(text) || (t.description ?? '').toLowerCase().includes(text) || (t.tags ?? []).some(g => g.toLowerCase().includes(text))));
  const limit = Math.min(q.limit ?? 50, LIMITS.results);
  return { state: s, value: rows.slice(0, limit).map(t => taskView(s, t)), error: undefined };
}

export function getTask(s: AppState, agentId: string, taskId: string): Out<unknown> {
  const t = visibleTask(s, agentId, taskId); if (!t) return fail(s, 'No such task in your scope. Use the id from list_tasks, not the title.');
  return { state: s, value: { ...taskView(s, t), description: t.description ?? '',
    comments: t.comments.slice(-10).map(c => ({ by: nameOf(s, c.authorId) ?? 'Someone', at: c.at, body: clip(c.body, 600) })),
    subtaskList: t.subtasks.map(x => ({ title: x.title, done: x.done })), recentHistory: t.history.slice(0, 8).map(h => ({ by: nameOf(s, h.actorId) ?? 'System', at: h.at, what: h.text })) } };
}

/* ---------- writes (as proposals) ---------- */
/** Agent activity is grouped into runs: calls close together share one, so a reviewer sees one batch rather than a drip. */
function runFor(s: AppState, agentId: string): { state: AppState; runId: string } {
  const latest = s.runs.find(r => r.agentId === agentId && r.source === 'mcp');
  if (latest) {
    const last = s.proposals.find(p => p.runId === latest.id)?.at ?? latest.at;
    if (Date.now() - Date.parse(last) < RUN_GAP_MS) return { state: s, runId: latest.id };
  }
  const label = `${nameOf(s, agentId) ?? 'Agent'} · ${new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  return A.startRun(s, agentId, label, { source: 'mcp' });
}

function propose(s: AppState, agentId: string, change: Change, reason: string): Out<ReturnType<typeof outcome>> {
  if (!agent(s, agentId)) return fail(s, 'Unknown agent.');
  const why = reason?.trim(); if (!why) return fail(s, 'Give a short reason. People see it when they review this.');
  if (why.length > LIMITS.reason) return fail(s, `Keep the reason under ${LIMITS.reason} characters.`);
  const { state: withRun, runId } = runFor(s, agentId);
  const n = A.submit(withRun, agentId, runId, change, why);
  return { state: n, value: outcome(n, n.proposals[0]) };
}

const bad = (s: AppState, msg: string) => fail(s, msg);
function checkText(s: AppState, label: string, v: string | undefined, max: number): Out<never> | null {
  if (v !== undefined && v.length > max) return bad(s, `${label} is too long (max ${max} characters).`);
  return null;
}

export interface NewTask { project: string; title: string; description?: string; column?: string; priority?: Priority; assignee?: string; due?: string; tags?: string[]; reason: string }
export function createTask(s: AppState, agentId: string, i: NewTask): Out<ReturnType<typeof outcome>> {
  const p = project(s, agentId, i.project); if (!p) return bad(s, 'No such project in your scope. Call list_projects.');
  const title = i.title?.trim(); if (!title) return bad(s, 'A title is required.');
  const e = checkText(s, 'Title', title, LIMITS.title) ?? checkText(s, 'Description', i.description, LIMITS.description); if (e) return e;
  const col = i.column ? columnOf(p, i.column) : p.columns[0]; if (!col) return bad(s, `No column “${i.column}”. Columns: ${p.columns.map(c => c.name).join(', ')}.`);
  if (i.priority && !PRIORITIES.includes(i.priority)) return bad(s, `Priority must be one of ${PRIORITIES.join(', ')}.`);
  if (i.due && !DAY.test(i.due)) return bad(s, 'Dates use YYYY-MM-DD.');
  const tags = (i.tags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean);
  if (tags.length > LIMITS.tags || tags.some(t => t.length > LIMITS.tag)) return bad(s, `Use at most ${LIMITS.tags} tags of ${LIMITS.tag} characters.`);
  let assigneeId: string | undefined; if (i.assignee) { assigneeId = userRef(s, p.workspaceId, i.assignee)?.id; if (!assigneeId) return bad(s, `No member matches “${i.assignee}”.`); }
  const draft = Object.fromEntries(Object.entries({ projectId: p.id, columnId: col.id, title, description: i.description, priority: i.priority, assigneeId, due: i.due, tags }).filter(([, v]) => v !== undefined)) as Extract<Change, { kind: 'create_task' }>['draft'];
  return propose(s, agentId, { kind: 'create_task', draft }, i.reason);
}

export interface TaskEdits { taskId: string; title?: string; description?: string; priority?: Priority; assignee?: string | null; start?: string | null; due?: string | null; tags?: string[]; reason: string }
/** One proposal per field, so a person can approve the priority change and reject the rename. */
export function updateTask(s: AppState, agentId: string, i: TaskEdits): Out<ReturnType<typeof outcome>[]> {
  const t = visibleTask(s, agentId, i.taskId); if (!t) return bad(s, 'No such task in your scope.');
  const e = checkText(s, 'Title', i.title, LIMITS.title) ?? checkText(s, 'Description', i.description, LIMITS.description); if (e) return e;
  if (i.title !== undefined && !i.title.trim()) return bad(s, 'A title cannot be empty.');
  if (i.priority && !PRIORITIES.includes(i.priority)) return bad(s, `Priority must be one of ${PRIORITIES.join(', ')}.`);
  for (const k of ['start', 'due'] as const) if (i[k] && !DAY.test(i[k]!)) return bad(s, 'Dates use YYYY-MM-DD.');
  const patches: Change[] = []; const add = (patch: Record<string, unknown>) => patches.push({ kind: 'update_task', taskId: t.id, patch });
  if (i.title !== undefined && i.title.trim() !== t.title) add({ title: i.title.trim() });
  if (i.description !== undefined && i.description !== t.description) add({ description: i.description });
  if (i.priority && i.priority !== t.priority) add({ priority: i.priority });
  if (i.assignee !== undefined) {
    if (i.assignee === null) { if (t.assigneeId) add({ assigneeId: undefined }); }
    else { const u = userRef(s, s.projects.find(p => p.id === t.projectId)!.workspaceId, i.assignee); if (!u) return bad(s, `No member matches “${i.assignee}”.`); if (u.id !== t.assigneeId) add({ assigneeId: u.id }); }
  }
  for (const k of ['start', 'due'] as const) if (i[k] !== undefined && (i[k] ?? undefined) !== t[k]) add({ [k]: i[k] ?? undefined });
  if (i.tags) { const tags = i.tags.map(x => x.trim().toLowerCase()).filter(Boolean); if (tags.length > LIMITS.tags || tags.some(x => x.length > LIMITS.tag)) return bad(s, `Use at most ${LIMITS.tags} tags of ${LIMITS.tag} characters.`); if (tags.join() !== t.tags.join()) add({ tags }); }
  if (!patches.length) return bad(s, 'Nothing to change: the task already has those values.');
  let n = s; const outs: ReturnType<typeof outcome>[] = [];
  for (const c of patches) { const r = propose(n, agentId, c, i.reason); if (r.error) return r as Out<never>; n = r.state; outs.push(r.value!); }
  return { state: n, value: outs };
}

export function moveTask(s: AppState, agentId: string, i: { taskId: string; column: string; reason: string }): Out<ReturnType<typeof outcome>> {
  const t = visibleTask(s, agentId, i.taskId); if (!t) return bad(s, 'No such task in your scope.');
  const p = s.projects.find(x => x.id === t.projectId)!; const col = columnOf(p, i.column);
  if (!col) return bad(s, `No column “${i.column}” in ${p.name}. Columns: ${p.columns.map(c => c.name).join(', ')}.`);
  if (col.id === t.columnId) return bad(s, `The task is already in ${col.name}.`);
  return propose(s, agentId, { kind: 'move_task', taskId: t.id, columnId: col.id }, i.reason);
}

export function comment(s: AppState, agentId: string, i: { taskId: string; body: string; reason: string }): Out<ReturnType<typeof outcome>> {
  const t = visibleTask(s, agentId, i.taskId); if (!t) return bad(s, 'No such task in your scope.');
  const body = i.body?.trim(); if (!body) return bad(s, 'The comment is empty.');
  const e = checkText(s, 'Comment', body, LIMITS.body); if (e) return e;
  return propose(s, agentId, { kind: 'comment', taskId: t.id, body }, i.reason);
}

/* ---------- own proposals and review ---------- */
export const listMyProposals = (s: AppState, agentId: string, status?: ProposalStatus, limit = 30) =>
  s.proposals.filter(p => p.agentId === agentId && (!status || p.status === status)).slice(0, Math.min(limit, LIMITS.results)).map(p => proposalView(s, p));

/** What this agent could approve right now: pending work by *other* agents, of kinds it was granted, in its projects. */
const reviewable = (s: AppState, agentId: string) =>
  s.proposals.filter(p => p.status === 'pending' && A.canDecide(s, agentId, p.agentId, { kind: A.policyKind(s, p.change), projectId: p.projectId }));
export const listToReview = (s: AppState, agentId: string) => reviewable(s, agentId).slice(0, LIMITS.results).map(p => ({ ...proposalView(s, p), proposedBy: nameOf(s, p.agentId) }));

export function review(s: AppState, agentId: string, i: { proposalId: string; verdict: 'approve' | 'reject' }): Out<ReturnType<typeof proposalView>> {
  const p = s.proposals.find(x => x.id === i.proposalId);
  if (!p || !reviewable(s, agentId).some(x => x.id === p.id)) return bad(s, 'You cannot review that proposal. It may not exist, be decided already, be your own, or be outside the kinds and projects you were granted.');
  const n = A.decideAs(s, agentId, p.id, i.verdict);
  return { state: n, value: proposalView(n, n.proposals.find(x => x.id === p.id)!) };
}
