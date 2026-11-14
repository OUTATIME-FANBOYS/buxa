/**
 * A scripted stand-in for a real agent, so the approval flow can be tried without any outside setup.
 * It reads one project and proposes the kind of things a triage agent would. It goes through exactly the
 * same `submit` path a real agent (over MCP or an API) will, so nothing here is special-cased.
 * Re-running it is safe: it skips anything it has already proposed or done.
 */
import type { AppState, Priority } from '../types';
import { diffDays, isoDay, today } from './dates';
import { PRIORITIES } from './tasks';
import { isOverdue } from './stats';
import * as A from './agents';

const MAX_PER_RULE = 2;

export function simulateRun(s: AppState, agentId: string, projectId: string): { state: AppState; count: number } {
  const project = s.projects.find(p => p.id === projectId); const agent = A.agentOf(s, agentId);
  if (!project || !agent) return { state: s, count: 0 };
  const kindOf = (colId: string) => project.columns.find(c => c.id === colId)?.kind ?? 'open';
  const tasks = s.tasks.filter(t => t.projectId === projectId && !t.archived);
  const open = tasks.filter(t => kindOf(t.columnId) !== 'done');
  const doneCol = project.columns.find(c => c.kind === 'done'); const firstCol = project.columns[0];
  const waiting = (kind: string, taskId: string) => s.proposals.some(p => p.status === 'pending' && p.change.kind === kind && 'taskId' in p.change && p.change.taskId === taskId);

  type Item = { change: Parameters<typeof A.submit>[3]; reason: string };
  const items: Item[] = [];

  // 1. High-priority work nobody owns: say so (cheap, reversible, so it can be automatic).
  open.filter(t => !t.assigneeId && (t.priority === 'high' || t.priority === 'critical')).slice(0, MAX_PER_RULE).forEach(t => {
    const body = `This ${t.priority}-priority task has no owner. Suggest assigning someone.`;
    if (!t.comments.some(c => c.body === body)) items.push({ change: { kind: 'comment', taskId: t.id, body }, reason: 'High-priority work with no assignee.' });
  });

  // 2. Overdue work that isn't marked urgent: propose raising its priority (changes a person's task, so it asks).
  open.filter(t => isOverdue(t, () => kindOf(t.columnId)) && t.priority !== 'critical').slice(0, MAX_PER_RULE).forEach(t => {
    const next: Priority = PRIORITIES[Math.min(PRIORITIES.length - 1, PRIORITIES.indexOf(t.priority) + 1)];
    if (!waiting('update_task', t.id)) items.push({ change: { kind: 'update_task', taskId: t.id, patch: { priority: next } }, reason: `Overdue by ${diffDays(today(), t.due!)} day${diffDays(today(), t.due!) === 1 ? '' : 's'}.` });
  });

  // 3. Everything checked off but still open: propose finishing it.
  if (doneCol) open.filter(t => t.subtasks.length > 0 && t.subtasks.every(x => x.done)).slice(0, MAX_PER_RULE).forEach(t => {
    if (!waiting('move_task', t.id)) items.push({ change: { kind: 'move_task', taskId: t.id, columnId: doneCol.id }, reason: `All ${t.subtasks.length} subtask${t.subtasks.length === 1 ? ' is' : 's are'} checked off.` });
  });

  // 3b. Due soon but not started: propose starting it.
  const started = project.columns.find(c => c.kind === 'active');
  if (started) open.filter(t => kindOf(t.columnId) === 'open' && t.due && diffDays(t.due, today()) >= 0 && diffDays(t.due, today()) <= 5).slice(0, MAX_PER_RULE).forEach(t => {
    if (!waiting('move_task', t.id)) items.push({ change: { kind: 'move_task', taskId: t.id, columnId: started.id }, reason: `Due in ${diffDays(t.due!, today())} day${diffDays(t.due!, today()) === 1 ? '' : 's'} and not started.` });
  });

  // 4. Recently finished work: open a follow-up to confirm it landed.
  tasks.filter(t => kindOf(t.columnId) === 'done' && t.completedAt && diffDays(today(), isoDay(t.completedAt)) <= 14).slice(0, MAX_PER_RULE).forEach(t => {
    const title = `Follow up: confirm “${t.title}” is in place`;
    if (!tasks.some(x => x.title === title)) items.push({ change: { kind: 'create_task', draft: { projectId, columnId: firstCol.id, title, priority: 'low', tags: ['follow-up'], description: `Opened automatically after “${t.title}” was completed.` } }, reason: 'Recently completed work usually needs a quick check that it stuck.' });
  });

  if (!items.length) return { state: s, count: 0 };
  const run = A.startRun(s, agentId, `Triage of ${project.name}`, { simulated: true });
  const state = items.reduce((n, i) => A.submit(n, agentId, run.runId, i.change, i.reason), run.state);
  return { state, count: items.length };
}
