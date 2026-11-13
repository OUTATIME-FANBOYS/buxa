/**
 * Agent governance: pure `(state, args) => state` functions, like `domain.ts`, which they build on.
 *
 * The model: an agent never edits the board directly. It *proposes* a `Change`. A trust policy then decides
 * whether the proposal is applied at once (`auto`), waits for a person (`approve`) or is refused (`never`).
 * Applying a proposal runs the ordinary domain command *as the agent*, so history, activity and
 * notifications behave exactly as they do for a person, plus a `via` record (run, proposal, reason).
 *
 * Invariants kept here:
 *  - a proposal's status only moves pending → approved | rejected | blocked, or applied/approved → reverted
 *  - the acting session and `acting` provenance are restored before any function returns
 *  - an approval is refused if the task changed since the proposal was made (stale)
 *  - a run is only reverted where it is still safe: a person's later work is never overwritten
 */
import type { Agent, AgentRun, AppState, Change, Proposal, ProposalKind, Trust, Undo, User, Via } from '../types';
import * as D from './domain';

export const PROPOSAL_KINDS: ProposalKind[] = ['create_task', 'comment', 'update_task', 'move_task', 'complete_task'];
export const KIND_LABEL: Record<ProposalKind, string> = {
  create_task: 'Create tasks', comment: 'Comment', update_task: 'Edit tasks', move_task: 'Move tasks', complete_task: 'Mark tasks done',
};
/** New agents start cautious: they may add work and talk, but anything that changes a person's work asks first. */
export const DEFAULT_TRUST: Record<ProposalKind, Trust> = { create_task: 'auto', comment: 'auto', update_task: 'approve', move_task: 'approve', complete_task: 'approve' };

export const isAgentUser = (s: AppState, userId?: string | null) => !!s.users.find(u => u.id === userId)?.agent;
export const agentOf = (s: AppState, userId: string) => s.agents.find(a => a.userId === userId);

/* ---------- helpers ---------- */
const taskOf = (s: AppState, id: string) => s.tasks.find(t => t.id === id);
const projectIdOf = (s: AppState, c: Change) => (c.kind === 'create_task' ? c.draft.projectId : taskOf(s, c.taskId)?.projectId);
const columnKind = (s: AppState, projectId: string, columnId: string) => s.projects.find(p => p.id === projectId)?.columns.find(x => x.id === columnId)?.kind;

/** The trust key a change is judged by: moving into a done column is "mark done", not just "move". */
export function policyKind(s: AppState, c: Change): ProposalKind {
  if (c.kind !== 'move_task') return c.kind;
  const pid = projectIdOf(s, c);
  return pid && columnKind(s, pid, c.columnId) === 'done' ? 'complete_task' : 'move_task';
}

export function evaluate(s: AppState, agent: Agent, c: Change): { level: Trust; why?: string } {
  if (agent.paused) return { level: 'never', why: 'The agent is paused.' };
  const pid = projectIdOf(s, c);
  if (!pid) return { level: 'never', why: 'The task no longer exists.' };
  if (!agent.scope.includes(pid)) return { level: 'never', why: 'Outside the agent’s project scope.' };
  // a rule for the destination stage beats the agent's general policy for moves
  const stage = c.kind === 'move_task' ? agent.moveRules[c.columnId] : undefined;
  const level = stage ?? agent.trust[policyKind(s, c)];
  return level === 'never' ? { level, why: 'Blocked by this agent’s policy.' } : { level };
}

/** What the task looks like right now, for the parts a change would touch. */
function basisOf(s: AppState, c: Change): string | undefined {
  if (c.kind === 'move_task') return JSON.stringify(taskOf(s, c.taskId)?.columnId);
  if (c.kind === 'update_task') { const t = taskOf(s, c.taskId); return t ? JSON.stringify(Object.keys(c.patch).map(k => (t as unknown as Record<string, unknown>)[k])) : undefined; }
  return undefined;
}

/** Run a domain command as the agent, then put the session back exactly as it was. */
export function runAs(s: AppState, agentId: string, via: Via, fn: (s: AppState) => AppState): AppState {
  const n = fn({ ...s, session: { userId: agentId }, acting: via });
  const { acting: _drop, ...rest } = n; void _drop;
  return { ...rest, session: s.session };
}

/**
 * Can this user decide on (approve or reject) work proposed by `agentId`?
 *  - a person: any non-viewer member of the agent's workspace
 *  - another agent: only if it was granted `approves` for this kind of change, is not paused, covers the
 *    project, and is not the proposer. An agent can never approve its own work.
 */
export function canDecide(s: AppState, userId: string | null | undefined, agentId: string, change?: { kind: ProposalKind; projectId: string }): boolean {
  const target = agentOf(s, agentId); if (!target || !userId) return false;
  if (isAgentUser(s, userId)) {
    const me = agentOf(s, userId);
    return !!me && !!change && userId !== agentId && !me.paused && me.workspaceId === target.workspaceId && me.scope.includes(change.projectId) && me.approves.includes(change.kind);
  }
  const role = s.workspaces.find(w => w.id === target.workspaceId)?.members.find(m => m.userId === userId)?.role;
  return !!role && role !== 'viewer';
}

/* ---------- applying a change ---------- */
type Applied = { state: AppState; undo?: Undo; taskId?: string; error?: string };

function apply(s: AppState, p: Proposal): Applied {
  const agent = agentOf(s, p.agentId); if (!agent) return { state: s, error: 'The agent no longer exists.' };
  const guard = evaluate(s, { ...agent, paused: false }, p.change); // scope still holds; pausing only stops new work
  if (guard.level === 'never') return { state: s, error: guard.why };
  const via: Via = { runId: p.runId, proposalId: p.id, reason: p.reason };
  const c = p.change;

  if (c.kind === 'create_task') {
    if (!columnKind(s, c.draft.projectId, c.draft.columnId)) return { state: s, error: 'That column no longer exists.' };
    const id = D.clock.id();
    return { state: runAs(s, p.agentId, via, x => D.createTask(x, id, { ...c.draft, tags: c.draft.tags ?? [] })), undo: { kind: 'delete_task', taskId: id }, taskId: id };
  }
  const t = taskOf(s, c.taskId); if (!t) return { state: s, error: 'The task no longer exists.' };
  if (basisOf(s, c) !== p.basis) return { state: s, error: 'The task changed after this was proposed.' };

  if (c.kind === 'comment') {
    const state = runAs(s, p.agentId, via, x => D.addComment(x, c.taskId, c.body));
    const comment = taskOf(state, c.taskId)?.comments.at(-1);
    return { state, taskId: t.id, undo: comment ? { kind: 'remove_comment', taskId: t.id, commentId: comment.id } : undefined };
  }
  if (c.kind === 'move_task') {
    if (!columnKind(s, t.projectId, c.columnId)) return { state: s, error: 'That column no longer exists.' };
    if (t.columnId === c.columnId) return { state: s, error: 'The task is already there.' };
    return { state: runAs(s, p.agentId, via, x => D.moveTask(x, t.id, c.columnId, null)), taskId: t.id, undo: { kind: 'move_back', taskId: t.id, columnId: t.columnId, landedIn: c.columnId } };
  }
  const before = Object.fromEntries(Object.keys(c.patch).map(k => [k, (t as unknown as Record<string, unknown>)[k]]));
  return { state: runAs(s, p.agentId, via, x => D.updateTask(x, t.id, c.patch)), taskId: t.id, undo: { kind: 'restore_fields', taskId: t.id, before, after: c.patch } };
}

/* ---------- runs and proposals ---------- */
export function startRun(s: AppState, agentId: string, label: string, extra: Partial<Pick<AgentRun, 'simulated' | 'source' | 'tokens' | 'costUsd'>> = {}): { state: AppState; runId: string } {
  const runId = D.clock.id();
  return { runId, state: { ...s, runs: [{ id: runId, agentId, label, at: D.clock.now(), ...extra }, ...s.runs].slice(0, 200) } };
}

const keep = (s: AppState, ps: Proposal[]): AppState => ({ ...s, proposals: ps.slice(0, 1000) });
const patchProposal = (s: AppState, id: string, f: (p: Proposal) => Proposal): AppState => ({ ...s, proposals: s.proposals.map(p => (p.id === id ? f(p) : p)) });

/** An agent proposes a change. The trust policy decides what happens next. */
export function submit(s: AppState, agentId: string, runId: string, change: Change, reason: string): AppState {
  const agent = agentOf(s, agentId); if (!agent) return s;
  const { level, why } = evaluate(s, agent, change);
  const base: Proposal = { id: D.clock.id(), runId, agentId, projectId: projectIdOf(s, change) ?? '', at: D.clock.now(), change, reason, status: 'pending', basis: basisOf(s, change) };
  if (level === 'never') return keep(s, [{ ...base, status: 'blocked', note: why }, ...s.proposals]);
  if (level === 'approve') return keep(s, [base, ...s.proposals]);
  const r = apply(s, base);
  if (r.error) return keep(s, [{ ...base, status: 'blocked', note: r.error }, ...s.proposals]);
  return keep(r.state, [{ ...base, status: 'applied', undo: r.undo, taskId: r.taskId, decidedAt: base.at }, ...s.proposals]);
}

/** A person approves or rejects a pending proposal. Approving applies it as the agent, unless it has gone stale. */
export function decide(s: AppState, proposalId: string, verdict: 'approve' | 'reject'): AppState {
  const p = s.proposals.find(x => x.id === proposalId); const by = s.session.userId;
  if (!p || p.status !== 'pending' || !canDecide(s, by, p.agentId, { kind: policyKind(s, p.change), projectId: p.projectId })) return s;
  const at = D.clock.now();
  if (verdict === 'reject') return patchProposal(s, p.id, x => ({ ...x, status: 'rejected', decidedAt: at, decidedBy: by! }));
  const r = apply(s, p);
  if (r.error) return patchProposal(s, p.id, x => ({ ...x, status: 'blocked', note: r.error, decidedAt: at, decidedBy: by! }));
  return patchProposal(r.state, p.id, x => ({ ...x, status: 'approved', undo: r.undo, taskId: r.taskId, decidedAt: at, decidedBy: by! }));
}

/** An agent with approval rights decides on another agent's proposal. Same rules as `decide`; the session is restored. */
export function decideAs(s: AppState, agentId: string, proposalId: string, verdict: 'approve' | 'reject'): AppState {
  const n = decide({ ...s, session: { userId: agentId } }, proposalId, verdict);
  return { ...n, session: s.session };
}

export const decideMany = (s: AppState, ids: string[], verdict: 'approve' | 'reject') => ids.reduce((n, id) => decide(n, id, verdict), s);

/** Undo everything a run did, where that is still safe. Anything a person has touched since is left alone and says why. */
export function revertRun(s: AppState, runId: string): { state: AppState; reverted: number; skipped: number } {
  const by = s.session.userId; let n = s; let reverted = 0; let skipped = 0;
  const mine = s.proposals.filter(p => p.runId === runId && (p.status === 'applied' || p.status === 'approved') && p.undo);
  for (const p of mine) { // newest first, so later changes are undone before the ones they depend on
    if (isAgentUser(n, by) || !canDecide(n, by, p.agentId)) { skipped++; continue; } // reverting is for people
    const u = p.undo!; const t = taskOf(n, u.taskId); let why: string | null = null; let next = n;
    if (!t) why = 'The task is already gone.';
    else if (u.kind === 'delete_task') {
      const touched = t.history.some(h => !h.via) || t.comments.some(c => !isAgentUser(n, c.authorId));
      if (touched) why = 'A person has worked on this task.'; else next = D.deleteTask(n, t.id);
    } else if (u.kind === 'move_back') {
      if (t.columnId !== u.landedIn) why = 'The task has moved again since.'; else next = D.moveTask(n, t.id, u.columnId, null);
    } else if (u.kind === 'restore_fields') {
      const same = Object.keys(u.after).every(k => JSON.stringify((t as unknown as Record<string, unknown>)[k]) === JSON.stringify((u.after as Record<string, unknown>)[k]));
      if (!same) why = 'It has been edited since.'; else next = D.updateTask(n, t.id, u.before);
    } else next = D.removeComment(n, t.id, u.commentId);
    if (why) { skipped++; n = patchProposal(n, p.id, x => ({ ...x, note: `Not reverted: ${why}` })); }
    else { reverted++; n = patchProposal(next, p.id, x => ({ ...x, status: 'reverted', note: undefined, decidedAt: D.clock.now(), decidedBy: by! })); }
  }
  return { state: n, reverted, skipped };
}

/* ---------- agents ---------- */
export function addAgent(s: AppState, workspaceId: string, name: string, model: string, purpose: string, scope: string[]): AppState {
  const id = 'u-agent-' + D.clock.id();
  const user: User = { id, name, email: `${id}@agents.local`, title: model, agent: true };
  const agent: Agent = { userId: id, workspaceId, model, purpose, scope, trust: { ...DEFAULT_TRUST }, paused: false, moveRules: {}, approves: [] };
  return {
    ...s, users: [...s.users, user], agents: [...s.agents, agent],
    workspaces: s.workspaces.map(w => (w.id === workspaceId ? { ...w, members: [...w.members, { userId: id, role: 'member' }] } : w)),
  };
}
export const updateAgent = (s: AppState, userId: string, patch: Partial<Pick<Agent, 'purpose' | 'scope' | 'paused' | 'model'>>): AppState =>
  ({ ...s, agents: s.agents.map(a => (a.userId === userId ? { ...a, ...patch } : a)) });
/** Set (or clear, with null) the policy for moving this agent's tasks into one stage. */
export function setMoveRule(s: AppState, userId: string, columnId: string, level: Trust | null): AppState {
  return { ...s, agents: s.agents.map(a => {
    if (a.userId !== userId) return a;
    const { [columnId]: _drop, ...rest } = a.moveRules; void _drop;
    return { ...a, moveRules: level ? { ...rest, [columnId]: level } : rest };
  }) };
}
export const setApproves = (s: AppState, userId: string, kinds: ProposalKind[]): AppState =>
  ({ ...s, agents: s.agents.map(a => (a.userId === userId ? { ...a, approves: kinds } : a)) });
export const setTrust = (s: AppState, userId: string, kind: ProposalKind, level: Trust): AppState =>
  ({ ...s, agents: s.agents.map(a => (a.userId === userId ? { ...a, trust: { ...a.trust, [kind]: level } } : a)) });

/* ---------- reading ---------- */
export interface Description { title: string; before: string; after: string; text: string; diff?: { label: string; from: string; to: string } }
/** A sentence about a change, split around the task title so the title can be a link. */
export function describe(s: AppState, c: Change, undo?: Undo): Description {
  const mk = (title: string, before: string, after: string, diff?: Description['diff']): Description => ({ title, before, after, text: `${before}“${title}”${after}`, diff });
  const colName = (pid: string | undefined, id: string) => s.projects.find(p => p.id === pid)?.columns.find(x => x.id === id)?.name ?? 'a column';
  if (c.kind === 'create_task') return mk(c.draft.title, 'Create ', ` in ${colName(c.draft.projectId, c.draft.columnId)}`);
  const t = taskOf(s, c.taskId); const title = t?.title ?? 'a deleted task';
  if (c.kind === 'comment') return mk(title, 'Comment on ', '', { label: 'Comment', from: '', to: c.body });
  if (c.kind === 'move_task') return mk(title, 'Move ', ` to ${colName(t?.projectId, c.columnId)}`, { label: 'Status', from: undo?.kind === 'move_back' ? colName(t?.projectId, undo.columnId) : t ? colName(t.projectId, t.columnId) : '', to: colName(t?.projectId, c.columnId) });
  const key = Object.keys(c.patch)[0] as keyof typeof c.patch;
  // once applied, the task already holds the new value, so the old one comes from the undo record
  const old = undo?.kind === 'restore_fields' ? (undo.before as Record<string, unknown>)[key] : t ? (t as unknown as Record<string, unknown>)[key] : '';
  const cur = String(old ?? '—');
  return mk(title, `Change ${key} on `, '', { label: String(key), from: cur, to: String(c.patch[key] ?? '—') });
}

export interface AgentStats { total: number; pending: number; auto: number; approved: number; rejected: number; blocked: number; reverted: number; acceptance: number | null; runs: number; costUsd: number }
export function agentStats(s: AppState, agentId?: string): AgentStats {
  const ps = s.proposals.filter(p => !agentId || p.agentId === agentId); const c = (st: Proposal['status']) => ps.filter(p => p.status === st).length;
  const approved = c('approved'); const rejected = c('rejected');
  const runs = s.runs.filter(r => !agentId || r.agentId === agentId);
  return {
    total: ps.length, pending: c('pending'), auto: c('applied'), approved, rejected, blocked: c('blocked'), reverted: c('reverted'),
    acceptance: approved + rejected ? approved / (approved + rejected) : null, runs: runs.length, costUsd: runs.reduce((a, r) => a + (r.costUsd ?? 0), 0),
  };
}
