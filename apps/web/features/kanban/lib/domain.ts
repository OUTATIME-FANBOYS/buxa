/**
 * Domain module: every business rule of the app as a pure `(state, args) => state` function.
 * No React, no storage, no randomness except through `clock`. This is the seam the store and the tests share.
 *
 * Invariants kept here (and nowhere else):
 *  - a task in a `done` column has `completedAt`; leaving it clears it
 *  - every task mutation leaves a history entry and an activity item
 *  - notifications are never sent to the acting user
 */
import type { AppState, Attachment, Column, ColumnKind, Filter, Notice, Priority, Project, Role, Task, User } from '../types';
import { defaultColumns } from './seed';
import { fmt } from './dates';
import { PRIORITY_LABEL, uid } from './tasks';

export const clock = { now: () => new Date().toISOString(), id: uid };

export type TaskDraft = Partial<Omit<Task, 'id' | 'history' | 'comments' | 'attachments' | 'createdAt' | 'createdBy'>> & { projectId: string; columnId: string; title: string };
export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'assigneeId' | 'start' | 'due' | 'tags'>>;

const nameOf = (s: AppState, id?: string | null) => s.users.find(u => u.id === id)?.name ?? 'Someone';
const mapTask = (s: AppState, id: string, f: (t: Task) => Task): AppState => ({ ...s, tasks: s.tasks.map(t => (t.id === id ? f(t) : t)) });
const mapProject = (s: AppState, id: string, f: (p: Project) => Project): AppState => ({ ...s, projects: s.projects.map(p => (p.id === id ? f(p) : p)) });

/* ---------- history & notifications ---------- */
export function log(s: AppState, taskId: string, verb: string, detail = ''): AppState {
  const actor = s.session.userId ?? 'system';
  const task = s.tasks.find(t => t.id === taskId); if (!task) return s;
  const at = clock.now();
  const via = s.acting;
  const entry = { id: clock.id(), at, actorId: actor, text: `${verb} this${detail ? ' ' + detail : ''}`, ...(via ? { via } : {}) };
  return {
    ...mapTask(s, taskId, t => ({ ...t, history: [entry, ...t.history] })),
    activity: [{ id: clock.id(), at, actorId: actor, projectId: task.projectId, taskId, taskTitle: task.title, verb, detail, ...(via ? { via } : {}) }, ...s.activity].slice(0, 400),
  };
}
export function notify(s: AppState, userId: string | undefined, kind: Notice['kind'], text: string, task?: Task): AppState {
  if (!userId || userId === s.session.userId) return s;
  return { ...s, notices: [{ id: clock.id(), userId, at: clock.now(), kind, text, read: false, taskId: task?.id, projectId: task?.projectId }, ...s.notices].slice(0, 300) };
}

/* ---------- accounts ---------- */
export function signUp(s: AppState, a: { userId: string; workspaceId: string; projectId: string; name: string; email: string; hash: string }): AppState {
  const cols = defaultColumns(); const at = clock.now();
  const mk = (title: string, col: number, priority: Priority, dueDays: number | null, description = ''): Task => ({
    id: clock.id(), projectId: a.projectId, columnId: cols[col].id, title, description, priority, assigneeId: a.userId,
    due: dueDays === null ? undefined : new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10),
    tags: [], subtasks: [], comments: [], attachments: [], history: [{ id: clock.id(), at, actorId: a.userId, text: 'created this' }],
    archived: false, createdAt: at, createdBy: a.userId,
  });
  return {
    ...s,
    users: [...s.users, { id: a.userId, name: a.name, email: a.email }],
    accounts: [...s.accounts, { email: a.email, hash: a.hash, userId: a.userId }],
    workspaces: [...s.workspaces, { id: a.workspaceId, name: `${a.name.split(' ')[0]}’s Workspace`, members: [{ userId: a.userId, role: 'owner' }] }],
    projects: [...s.projects, { id: a.projectId, workspaceId: a.workspaceId, name: 'My first project', description: 'A place to try things out. Rename it, or start a new project.', columns: cols, createdAt: at }],
    tasks: [...s.tasks,
      mk('Drag this card to another column', 1, 'medium', 2, 'Drag cards between columns, or use the ⋯ menu, or Alt + ← / →.'),
      mk('Open a card to add subtasks, comments and files', 1, 'low', 5),
      mk('Press C to create a task from anywhere', 0, 'low', null)],
    session: { userId: a.userId }, ui: { ...s.ui, workspaceId: a.workspaceId, projectId: a.projectId, view: 'board', agentsEnabled: false },
  };
}

/** Where the UI should land for a user: their workspace/project, falling back to the first they belong to. */
export function uiFor(s: AppState, userId: string): AppState['ui'] {
  const ws = s.workspaces.find(w => w.id === s.ui.workspaceId && w.members.some(m => m.userId === userId)) ?? s.workspaces.find(w => w.members.some(m => m.userId === userId));
  const proj = s.projects.find(p => p.id === s.ui.projectId && p.workspaceId === ws?.id) ?? s.projects.find(p => p.workspaceId === ws?.id);
  return { ...s.ui, workspaceId: ws?.id ?? '', projectId: proj?.id ?? '' };
}

/* ---------- tasks ---------- */
export function createTask(s: AppState, id: string, d: TaskDraft): AppState {
  const actor = s.session.userId ?? 'system';
  const kind = s.projects.find(p => p.id === d.projectId)?.columns.find(c => c.id === d.columnId)?.kind;
  const given = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as typeof d; // `{ description: undefined }` must not erase the default
  const task: Task = { description: '', priority: 'medium', tags: [], subtasks: [], comments: [], attachments: [], archived: false, ...given, id, history: [], createdAt: clock.now(), createdBy: actor, completedAt: kind === 'done' ? clock.now() : undefined };
  let n = log({ ...s, tasks: [...s.tasks, task] }, id, 'created');
  if (task.assigneeId) n = notify(n, task.assigneeId, 'assign', `${nameOf(n, actor)} assigned you “${task.title}”`, task);
  return n;
}

export function updateTask(s: AppState, id: string, patch: TaskPatch): AppState {
  const old = s.tasks.find(t => t.id === id); if (!old) return s;
  let n = mapTask(s, id, t => ({ ...t, ...patch }));
  const actor = nameOf(s, s.session.userId);
  if ('title' in patch && patch.title !== old.title) n = log(n, id, 'renamed', `from “${old.title}”`);
  if ('description' in patch && patch.description !== old.description) n = log(n, id, 'edited the description of');
  if ('priority' in patch && patch.priority !== old.priority) n = log(n, id, 'changed priority of', `to ${PRIORITY_LABEL[patch.priority!]}`);
  if ('assigneeId' in patch && patch.assigneeId !== old.assigneeId) {
    if (patch.assigneeId) { n = log(n, id, 'assigned', `to ${nameOf(s, patch.assigneeId)}`); n = notify(n, patch.assigneeId, 'assign', `${actor} assigned you “${old.title}”`, old); }
    else n = log(n, id, 'unassigned');
  }
  if ('due' in patch && patch.due !== old.due) n = log(n, id, patch.due ? 'set the due date of' : 'cleared the due date of', patch.due ? `to ${fmt(patch.due)}` : '');
  if ('start' in patch && patch.start !== old.start) n = log(n, id, patch.start ? 'set the start date of' : 'cleared the start date of', patch.start ? `to ${fmt(patch.start)}` : '');
  if ('tags' in patch && patch.tags!.join() !== old.tags.join()) n = log(n, id, 'updated tags on');
  return n;
}

/** Move a task to a column, before `beforeId` (or to the end). Owns the completedAt invariant and status notifications. */
export function moveTask(s: AppState, id: string, columnId: string, beforeId: string | null): AppState {
  const t = s.tasks.find(x => x.id === id); if (!t) return s;
  const proj = s.projects.find(p => p.id === t.projectId); const col = proj?.columns.find(c => c.id === columnId); if (!proj || !col) return s;
  const changed = t.columnId !== columnId;
  const wasDone = proj.columns.find(c => c.id === t.columnId)?.kind === 'done';
  const completing = changed && col.kind === 'done' && !wasDone;
  const moved: Task = { ...t, columnId, completedAt: completing ? clock.now() : changed && col.kind !== 'done' ? undefined : t.completedAt };
  const rest = s.tasks.filter(x => x.id !== id);
  let idx = beforeId ? rest.findIndex(x => x.id === beforeId) : -1;
  if (idx < 0) { let last = -1; rest.forEach((x, i) => { if (x.projectId === t.projectId && x.columnId === columnId) last = i; }); idx = last >= 0 ? last + 1 : rest.length; }
  rest.splice(idx, 0, moved);
  let n: AppState = { ...s, tasks: rest };
  if (!changed) return n;
  const actor = nameOf(s, s.session.userId);
  n = completing ? log(n, id, 'completed') : log(n, id, 'moved', `to ${col.name}`);
  n = notify(n, t.assigneeId, completing ? 'complete' : 'status', completing ? `${actor} completed “${t.title}”` : `${actor} moved “${t.title}” to ${col.name}`, t);
  if (completing && t.createdBy !== t.assigneeId) n = notify(n, t.createdBy, 'complete', `${actor} completed “${t.title}”`, t);
  return n;
}

export function duplicateTask(s: AppState, id: string, nid: string): AppState {
  const t = s.tasks.find(x => x.id === id); if (!t) return s;
  const copy: Task = { ...t, id: nid, title: `${t.title} (copy)`, comments: [], attachments: [], history: [], subtasks: t.subtasks.map(x => ({ ...x, id: clock.id(), done: false })), createdAt: clock.now(), createdBy: s.session.userId ?? t.createdBy, completedAt: undefined, archived: false };
  const tasks = [...s.tasks]; tasks.splice(s.tasks.findIndex(x => x.id === id) + 1, 0, copy);
  return log({ ...s, tasks }, nid, 'duplicated', `from “${t.title}”`);
}
export const archiveTask = (s: AppState, id: string, archived: boolean) => log(mapTask(s, id, t => ({ ...t, archived })), id, archived ? 'archived' : 'restored');
export const deleteTask = (s: AppState, id: string): AppState => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) });
export const restoreTask = (s: AppState, t: Task): AppState => (s.tasks.some(x => x.id === t.id) ? s : { ...s, tasks: [...s.tasks, t] });

export const addSubtask = (s: AppState, id: string, title: string) => mapTask(s, id, t => ({ ...t, subtasks: [...t.subtasks, { id: clock.id(), title, done: false }] }));
export const removeSubtask = (s: AppState, id: string, sid: string) => mapTask(s, id, t => ({ ...t, subtasks: t.subtasks.filter(x => x.id !== sid) }));
export function toggleSubtask(s: AppState, id: string, sid: string): AppState {
  const st = s.tasks.find(x => x.id === id)?.subtasks.find(x => x.id === sid); if (!st) return s;
  const n = mapTask(s, id, t => ({ ...t, subtasks: t.subtasks.map(y => (y.id === sid ? { ...y, done: !y.done } : y)) }));
  return st.done ? n : log(n, id, 'checked off a subtask on', `“${st.title}”`);
}

/** Mentions are `@FirstName` of a user; mentioned users are notified, otherwise the assignee is. */
export const mentionedUserIds = (s: AppState, body: string): string[] =>
  Array.from(new Set(Array.from(body.matchAll(/@([\p{L}]+)/gu)).map(m => s.users.find(u => u.name.split(' ')[0].toLowerCase() === m[1].toLowerCase())?.id).filter(Boolean) as string[]));

export function addComment(s: AppState, id: string, body: string): AppState {
  const t = s.tasks.find(x => x.id === id); if (!t) return s;
  const actorId = s.session.userId ?? 'system'; const actor = nameOf(s, actorId);
  let n = log(mapTask(s, id, x => ({ ...x, comments: [...x.comments, { id: clock.id(), authorId: actorId, body, at: clock.now() }] })), id, 'commented on');
  const mentioned = mentionedUserIds(s, body);
  mentioned.forEach(u => { n = notify(n, u, 'mention', `${actor} mentioned you in “${t.title}”`, t); });
  if (t.assigneeId && !mentioned.includes(t.assigneeId)) n = notify(n, t.assigneeId, 'comment', `${actor} commented on “${t.title}”`, t);
  return n;
}
export const addAttachment = (s: AppState, id: string, a: Omit<Attachment, 'id' | 'at'>) =>
  log(mapTask(s, id, t => ({ ...t, attachments: [...t.attachments, { ...a, id: clock.id(), at: clock.now() }] })), id, 'attached a file to', `“${a.name}”`);
export const removeComment = (s: AppState, id: string, cid: string) => mapTask(s, id, t => ({ ...t, comments: t.comments.filter(c => c.id !== cid) }));
export const removeAttachment = (s: AppState, id: string, aid: string) => mapTask(s, id, t => ({ ...t, attachments: t.attachments.filter(a => a.id !== aid) }));

/* ---------- columns ---------- */
export const createColumn = (s: AppState, projectId: string, name: string, kind: ColumnKind) => mapProject(s, projectId, p => ({ ...p, columns: [...p.columns, { id: clock.id(), name, kind }] }));
/** Changing a column's kind re-establishes the invariant for the tasks inside it: done ⇔ completedAt. */
export function updateColumn(s: AppState, projectId: string, colId: string, patch: Partial<Column>): AppState {
  const old = s.projects.find(p => p.id === projectId)?.columns.find(c => c.id === colId);
  let n = mapProject(s, projectId, p => ({ ...p, columns: p.columns.map(c => (c.id === colId ? { ...c, ...patch } : c)) }));
  if (old && patch.kind && patch.kind !== old.kind) {
    const done = patch.kind === 'done'; const at = clock.now();
    n = { ...n, tasks: n.tasks.map(t => (t.projectId === projectId && t.columnId === colId ? { ...t, completedAt: done ? t.completedAt ?? at : undefined } : t)) };
  }
  return n;
}
export function deleteColumn(s: AppState, projectId: string, colId: string, moveTo: string): AppState {
  const target = s.projects.find(p => p.id === projectId)?.columns.find(c => c.id === moveTo);
  const n = { ...s, tasks: s.tasks.map(t => (t.projectId === projectId && t.columnId === colId ? { ...t, columnId: moveTo, completedAt: target?.kind === 'done' ? t.completedAt ?? clock.now() : undefined } : t)) };
  return mapProject(n, projectId, p => ({ ...p, columns: p.columns.filter(c => c.id !== colId) }));
}
export const moveColumn = (s: AppState, projectId: string, colId: string, beforeId: string | null) => mapProject(s, projectId, p => {
  const col = p.columns.find(c => c.id === colId); if (!col || beforeId === colId) return p;
  const rest = p.columns.filter(c => c.id !== colId); const i = beforeId ? rest.findIndex(c => c.id === beforeId) : rest.length;
  rest.splice(i < 0 ? rest.length : i, 0, col); return { ...p, columns: rest };
});

/* ---------- projects, workspaces, people ---------- */
export const createProject = (s: AppState, id: string, workspaceId: string, name: string, description: string, deadline?: string): AppState =>
  ({ ...s, projects: [...s.projects, { id, workspaceId, name, description, deadline, columns: defaultColumns(), createdAt: clock.now() }], ui: { ...s.ui, projectId: id, workspaceId } });
export const updateProject = (s: AppState, id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'deadline'>>) => mapProject(s, id, p => ({ ...p, ...patch }));
export function deleteProject(s: AppState, id: string): AppState {
  const projects = s.projects.filter(p => p.id !== id); const next = projects.find(p => p.workspaceId === s.ui.workspaceId);
  return { ...s, projects, tasks: s.tasks.filter(t => t.projectId !== id), proposals: s.proposals.filter(p => p.projectId !== id), activity: s.activity.filter(a => a.projectId !== id), ui: { ...s.ui, projectId: s.ui.projectId === id ? next?.id ?? '' : s.ui.projectId } };
}
export const createWorkspace = (s: AppState, id: string, name: string): AppState =>
  ({ ...s, workspaces: [...s.workspaces, { id, name, members: [{ userId: s.session.userId!, role: 'owner' }] }], ui: { ...s.ui, workspaceId: id, projectId: '' } });

export function invite(s: AppState, workspaceId: string, email: string, role: Role): { state: AppState; error: string | null } {
  const e = email.trim().toLowerCase(); const ws = s.workspaces.find(w => w.id === workspaceId); if (!ws) return { state: s, error: 'Workspace not found.' };
  let user: User | undefined = s.users.find(u => u.email.toLowerCase() === e); let users = s.users;
  if (user && ws.members.some(m => m.userId === user!.id)) return { state: s, error: 'That person is already in this workspace.' };
  if (!user) { user = { id: 'u-' + clock.id(), name: e.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email: e, pending: true }; users = [...users, user]; }
  const n = { ...s, users, workspaces: s.workspaces.map(w => (w.id === workspaceId ? { ...w, members: [...w.members, { userId: user!.id, role }] } : w)) };
  return { state: notify(n, user.id, 'invite', `${nameOf(s, s.session.userId)} added you to ${ws.name}`), error: null };
}
export const setRole = (s: AppState, workspaceId: string, userId: string, role: Role): AppState =>
  ({ ...s, workspaces: s.workspaces.map(w => (w.id === workspaceId ? { ...w, members: w.members.map(m => (m.userId === userId ? { ...m, role } : m)) } : w)) });
export const removeMember = (s: AppState, workspaceId: string, userId: string): AppState => ({
  ...s,
  workspaces: s.workspaces.map(w => (w.id === workspaceId ? { ...w, members: w.members.filter(m => m.userId !== userId) } : w)),
  tasks: s.tasks.map(t => (t.assigneeId === userId && s.projects.find(p => p.id === t.projectId)?.workspaceId === workspaceId ? { ...t, assigneeId: undefined } : t)),
});

/* ---------- filters & notices ---------- */
export const saveFilter = (s: AppState, name: string, projectId: string, filter: Filter): AppState => ({ ...s, savedFilters: [...s.savedFilters, { id: clock.id(), name, projectId, filter }] });
export const deleteSavedFilter = (s: AppState, id: string): AppState => ({ ...s, savedFilters: s.savedFilters.filter(f => f.id !== id) });
export const markNoticeRead = (s: AppState, id: string): AppState => ({ ...s, notices: s.notices.map(n => (n.id === id ? { ...n, read: true } : n)) });
export const markAllRead = (s: AppState): AppState => ({ ...s, notices: s.notices.map(n => (n.userId === s.session.userId ? { ...n, read: true } : n)) });
