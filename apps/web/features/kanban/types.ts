export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ColumnKind = 'open' | 'active' | 'done';
export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export type Sort = 'manual' | 'created' | 'priority' | 'due';
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
export type ViewKind = 'board' | 'list' | 'calendar' | 'timeline';
export type ThemePref = 'system' | 'light' | 'dark';

export interface User { id: string; name: string; email: string; title?: string; pending?: boolean; agent?: boolean }
export interface Account { email: string; hash: string; userId: string; demo?: boolean }
export interface Member { userId: string; role: Role }
export interface Workspace { id: string; name: string; members: Member[] }
export interface Column { id: string; name: string; kind: ColumnKind }
export interface Project {
  id: string; workspaceId: string; name: string; description: string;
  deadline?: string; columns: Column[]; createdAt: string;
}
export interface Subtask { id: string; title: string; done: boolean }
export interface Comment { id: string; authorId: string; body: string; at: string }
export interface Attachment { id: string; name: string; size: number; type: string; dataUrl?: string; at: string }
/** Provenance for a change made by an agent: which run, why, and which proposal it came from. */
export interface Via { runId: string; proposalId: string; reason: string }
export interface HistoryEntry { id: string; at: string; actorId: string; text: string; via?: Via }
export interface Task {
  id: string; projectId: string; columnId: string; title: string; description: string;
  priority: Priority; assigneeId?: string; start?: string; due?: string; tags: string[];
  subtasks: Subtask[]; comments: Comment[]; attachments: Attachment[]; history: HistoryEntry[];
  archived: boolean; createdAt: string; createdBy: string; completedAt?: string;
}
export interface ActivityItem {
  id: string; at: string; actorId: string; projectId: string; taskId?: string;
  taskTitle: string; verb: string; detail: string; via?: Via;
}
export interface Notice {
  id: string; userId: string; at: string; text: string; read: boolean;
  kind: 'assign' | 'status' | 'comment' | 'mention' | 'complete' | 'invite';
  taskId?: string; projectId?: string;
}
export interface Filter {
  q: string; priorities: Priority[]; assignees: string[]; columns: string[];
  due: DueFilter; tags: string[]; sort: Sort; archived: boolean;
}
export interface SavedFilter { id: string; name: string; projectId: string; filter: Filter }
export interface UiState {
  workspaceId: string; projectId: string; view: ViewKind; theme: ThemePref; sidebarCollapsed: boolean;
  /** Off by default: with it off the app is a plain Kanban board and shows no agent UI. */
  agentsEnabled: boolean;
}
export interface AppState {
  version: 1;
  users: User[]; accounts: Account[]; workspaces: Workspace[]; projects: Project[];
  tasks: Task[]; activity: ActivityItem[]; notices: Notice[]; savedFilters: SavedFilter[];
  agents: Agent[]; runs: AgentRun[]; proposals: Proposal[];
  session: { userId: string | null }; ui: UiState;
  /** Transient: set only while an agent's change is being applied, so history can record provenance. Never persisted. */
  acting?: Via;
}

/* ---------- agents: identity, policy, proposals, audit ---------- */
export type ProposalKind = 'create_task' | 'comment' | 'move_task' | 'complete_task' | 'update_task';
/** auto: apply immediately · approve: queue for a human · never: block */
export type Trust = 'auto' | 'approve' | 'never';
export interface Agent {
  userId: string; workspaceId: string; model: string; purpose: string;
  /** Projects the agent may touch. Anything else is blocked. */
  scope: string[]; trust: Record<ProposalKind, Trust>; paused: boolean;
  /** Per-stage override for moving a task *into* a column (column id → policy). Beats `trust` for that column. */
  moveRules: Record<string, Trust>;
  /** Kinds of change from *other* agents this agent may approve. Empty by default; never its own work. */
  approves: ProposalKind[];
}
export type TaskDraftChange = { projectId: string; columnId: string; title: string; description?: string; priority?: Priority; assigneeId?: string; due?: string; tags?: string[] };
export type TaskPatchChange = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'assigneeId' | 'start' | 'due' | 'tags'>>;
export type Change =
  | { kind: 'create_task'; draft: TaskDraftChange }
  | { kind: 'comment'; taskId: string; body: string }
  | { kind: 'move_task'; taskId: string; columnId: string }
  | { kind: 'update_task'; taskId: string; patch: TaskPatchChange };
export type ProposalStatus = 'pending' | 'applied' | 'approved' | 'rejected' | 'blocked' | 'reverted';
/** How to undo an applied proposal, and what must still be true for the undo to be safe. */
export type Undo =
  | { kind: 'delete_task'; taskId: string }
  | { kind: 'move_back'; taskId: string; columnId: string; landedIn: string }
  | { kind: 'restore_fields'; taskId: string; before: TaskPatchChange; after: TaskPatchChange }
  | { kind: 'remove_comment'; taskId: string; commentId: string };
export interface Proposal {
  id: string; runId: string; agentId: string; projectId: string; at: string;
  change: Change; reason: string; status: ProposalStatus;
  /** What the task looked like when proposed; a changed task makes an approval stale. */
  basis?: string;
  decidedAt?: string; decidedBy?: string; note?: string; undo?: Undo; taskId?: string;
}
export interface AgentRun { id: string; agentId: string; label: string; at: string; simulated?: boolean; source?: 'mcp'; tokens?: number; costUsd?: number }
