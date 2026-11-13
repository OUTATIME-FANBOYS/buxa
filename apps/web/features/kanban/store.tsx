import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProposalKind, Trust, AppState, Attachment, Column, ColumnKind, Filter, Role, Task, ThemePref, UiState, User, ViewKind } from './types';
import * as D from './lib/domain';
import { DEMO_PASSWORD } from './lib/seed';
import { buildDemo } from './lib/demo';
import * as Ag from './lib/agents';
import { simulateRun } from './lib/agentSim';
import { createSync, type SyncState, type Updater } from './lib/sync';
import { repairData } from './lib/dataSlices';
import { today } from './lib/dates';
import { uid } from './lib/tasks';

const KEY = 'buxa.state.v1';
const LEGACY_KEY = 'tessera.state.v1'; // the app's previous name; read once so nobody loses their data
export type SaveStatus = 'saved' | 'saving' | 'error';

/** Data saved before agents existed lacks their fields; fill them in rather than discard the user's work. */
export function normalize(s: AppState): AppState {
  const { acting: _drop, ...fixed } = repairData(s); void _drop; const rest = fixed;
  return { ...rest, agents: (s.agents ?? []).map(a => ({ ...a, moveRules: a.moveRules ?? {}, approves: a.approves ?? [] })), runs: s.runs ?? [], proposals: s.proposals ?? [], ui: { ...s.ui, agentsEnabled: s.ui.agentsEnabled ?? false } };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) { const s = JSON.parse(raw) as AppState; if (s.version === 1) return normalize(s); }
  } catch { /* fall through to seed */ }
  return buildDemo();
}

async function sha(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h);
}

/** Persistence adapter. One implementation today (localStorage); an API client would satisfy the same two calls. */
const storage = {
  save(state: AppState) { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem('buxa.theme', JSON.stringify(state.ui.theme));
    localStorage.removeItem(LEGACY_KEY); localStorage.removeItem('tessera.theme'); },
};

/** Binds the pure domain to React state. Actions are created once, so their identity is stable. */
function createActions(set: (fn: (s: AppState) => AppState) => void, get: () => AppState, replace: (s: AppState) => void) {
  const A = {
    // ---------- auth (needs async hashing, so it reads state through `get`) ----------
    async signIn(email: string, password: string): Promise<string | null> {
      const e = email.trim().toLowerCase(); const acc = get().accounts.find(a => a.email.toLowerCase() === e);
      if (!acc) return 'No account found for that email.';
      const ok = acc.demo ? password === DEMO_PASSWORD : (await sha(acc.email + ':' + password)) === acc.hash;
      if (!ok) return 'That password is not correct.';
      A.switchUser(acc.userId); return null;
    },
    async signUp(name: string, email: string, password: string): Promise<string | null> {
      const e = email.trim().toLowerCase();
      if (get().accounts.some(a => a.email.toLowerCase() === e)) return 'An account with that email already exists.';
      const hash = await sha(e + ':' + password);
      set(s => D.signUp(s, { userId: 'u-' + uid(), workspaceId: 'w-' + uid(), projectId: 'p-' + uid(), name: name.trim(), email: e, hash }));
      return null;
    },
    signOut: () => set(s => ({ ...s, session: { userId: null } })),
    switchUser: (userId: string) => set(s => ({ ...s, session: { userId }, ui: D.uiFor(s, userId) })),
    updateProfile: (patch: Partial<Pick<User, 'name' | 'title'>>) => set(s => ({ ...s, users: s.users.map(u => (u.id === s.session.userId ? { ...u, ...patch } : u)) })),

    // ---------- ui ----------
    setUi: (patch: Partial<UiState>) => set(s => ({ ...s, ui: { ...s.ui, ...patch } })),
    setTheme: (theme: ThemePref) => set(s => ({ ...s, ui: { ...s.ui, theme } })),
    setView: (view: ViewKind) => set(s => ({ ...s, ui: { ...s.ui, view } })),
    selectProject: (projectId: string) => set(s => { const p = s.projects.find(x => x.id === projectId); return p ? { ...s, ui: { ...s.ui, projectId, workspaceId: p.workspaceId } } : s; }),
    selectWorkspace: (workspaceId: string) => set(s => ({ ...s, ui: { ...s.ui, workspaceId, projectId: s.projects.find(x => x.workspaceId === workspaceId)?.id ?? '' } })),

    // ---------- domain commands: ids are minted here, rules live in the domain ----------
    createTask(d: D.TaskDraft): string { const id = uid(); set(s => D.createTask(s, id, d)); return id; },
    updateTask: (id: string, patch: D.TaskPatch) => set(s => D.updateTask(s, id, patch)),
    moveTask: (id: string, columnId: string, beforeId: string | null) => set(s => D.moveTask(s, id, columnId, beforeId)),
    duplicateTask(id: string): string { const nid = uid(); set(s => D.duplicateTask(s, id, nid)); return nid; },
    archiveTask: (id: string, archived: boolean) => set(s => D.archiveTask(s, id, archived)),
    deleteTask: (id: string) => set(s => D.deleteTask(s, id)),
    restoreTask: (t: Task) => set(s => D.restoreTask(s, t)),
    addSubtask: (id: string, title: string) => set(s => D.addSubtask(s, id, title)),
    toggleSubtask: (id: string, sid: string) => set(s => D.toggleSubtask(s, id, sid)),
    removeSubtask: (id: string, sid: string) => set(s => D.removeSubtask(s, id, sid)),
    addComment: (id: string, body: string) => set(s => D.addComment(s, id, body)),
    addAttachment: (id: string, a: Omit<Attachment, 'id' | 'at'>) => set(s => D.addAttachment(s, id, a)),
    removeAttachment: (id: string, aid: string) => set(s => D.removeAttachment(s, id, aid)),
    createColumn: (projectId: string, name: string, kind: ColumnKind) => set(s => D.createColumn(s, projectId, name, kind)),
    updateColumn: (projectId: string, colId: string, patch: Partial<Column>) => set(s => D.updateColumn(s, projectId, colId, patch)),
    deleteColumn: (projectId: string, colId: string, moveTo: string) => set(s => D.deleteColumn(s, projectId, colId, moveTo)),
    moveColumn: (projectId: string, colId: string, beforeId: string | null) => set(s => D.moveColumn(s, projectId, colId, beforeId)),
    createProject(workspaceId: string, name: string, description: string, deadline?: string): string { const id = 'p-' + uid(); set(s => D.createProject(s, id, workspaceId, name, description, deadline)); return id; },
    updateProject: (id: string, patch: Partial<{ name: string; description: string; deadline?: string }>) => set(s => D.updateProject(s, id, patch)),
    deleteProject: (id: string) => set(s => D.deleteProject(s, id)),
    createWorkspace(name: string): string { const id = 'w-' + uid(); set(s => D.createWorkspace(s, id, name)); return id; },
    invite(workspaceId: string, email: string, role: Role): string | null {
      const r = D.invite(get(), workspaceId, email, role); if (!r.error) set(s => D.invite(s, workspaceId, email, role).state); return r.error;
    },
    setRole: (w: string, u: string, role: Role) => set(s => D.setRole(s, w, u, role)),
    removeMember: (w: string, u: string) => set(s => D.removeMember(s, w, u)),
    saveFilter: (name: string, projectId: string, filter: Filter) => set(s => D.saveFilter(s, name, projectId, filter)),
    deleteSavedFilter: (id: string) => set(s => D.deleteSavedFilter(s, id)),
    markNoticeRead: (id: string) => set(s => D.markNoticeRead(s, id)),
    markAllRead: () => set(D.markAllRead),

    // ---------- agents ----------
    setAgentsEnabled: (on: boolean) => set(s => ({ ...s, ui: { ...s.ui, agentsEnabled: on } })),
    addAgent: (workspaceId: string, name: string, model: string, purpose: string, scope: string[]) => set(s => Ag.addAgent(s, workspaceId, name, model, purpose, scope)),
    updateAgent: (id: string, patch: Parameters<typeof Ag.updateAgent>[2]) => set(s => Ag.updateAgent(s, id, patch)),
    setTrust: (id: string, kind: Parameters<typeof Ag.setTrust>[2], level: Parameters<typeof Ag.setTrust>[3]) => set(s => Ag.setTrust(s, id, kind, level)),
    setMoveRule: (id: string, columnId: string, level: Trust | null) => set(s => Ag.setMoveRule(s, id, columnId, level)),
    setApproves: (id: string, kinds: ProposalKind[]) => set(s => Ag.setApproves(s, id, kinds)),
    decide: (proposalId: string, verdict: 'approve' | 'reject') => set(s => Ag.decide(s, proposalId, verdict)),
    decideMany: (ids: string[], verdict: 'approve' | 'reject') => set(s => Ag.decideMany(s, ids, verdict)),
    revertRun(runId: string): { reverted: number; skipped: number } {
      const r = Ag.revertRun(get(), runId); set(s => Ag.revertRun(s, runId).state); return { reverted: r.reverted, skipped: r.skipped };
    },
    simulateRun(agentId: string, projectId: string): number {
      const r = simulateRun(get(), agentId, projectId); if (r.count) set(s => simulateRun(s, agentId, projectId).state); return r.count;
    },

    // ---------- data ----------
    exportData: () => JSON.stringify(get(), null, 2),
    importData(json: string): string | null {
      try {
        const d = JSON.parse(json) as AppState;
        if (d.version !== 1 || !Array.isArray(d.tasks) || !Array.isArray(d.projects) || !Array.isArray(d.users)) return 'This file is not a Buxa export.';
        replace(normalize(d)); return null;
      } catch { return 'This file could not be read as JSON.'; }
    },
    resetDemo: () => replace(buildDemo()),
  };
  return A;
}
export type Actions = ReturnType<typeof createActions>;

export function useStoreInternal() {
  const [state, setState] = useState<AppState>(load);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [sync, setSync] = useState<SyncState>('connecting'); const [serverInfo, setServerInfo] = useState<{ mcpUrl?: string }>({});
  const first = useRef(true);
  // The latest state, updated synchronously by every change (React's own copy lags by a render).
  const ref = useRef(state);
  const pending = useRef<Updater[]>([]); const engine = useRef<ReturnType<typeof createSync> | null>(null); const syncRef = useRef<SyncState>('connecting');

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveStatus('saving');
    const id = setTimeout(() => { try { storage.save(state); setSaveStatus('saved'); } catch { setSaveStatus('error'); } }, 250);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const apply = () => {
      const t = state.ui.theme; const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply(); const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.ui.theme]);

  const set = useCallback((fn: Updater) => {
    const next = fn(ref.current); if (next === ref.current) return;
    ref.current = next; setState(next);
    if (syncRef.current !== 'local') { pending.current.push(fn); engine.current?.changed(); }
  }, []);

  useEffect(() => {
    const e = createSync({
      getState: () => ref.current, commit: s => { ref.current = s; setState(s); }, pending: pending.current,
      onStatus: (s, info) => { syncRef.current = s; setSync(s); if (info) setServerInfo(info); },
    });
    engine.current = e; return () => { e.stop(); engine.current = null; };
  }, []);

  const actions = useMemo(() => createActions(set, () => ref.current, s => set(() => s)), [set]);
  return { state, saveStatus, sync, serverInfo, actions };
}

type Store = ReturnType<typeof useStoreInternal>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreInternal();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx); if (!v) throw new Error('StoreProvider missing');
  const { state: s, actions, saveStatus, sync, serverInfo } = v;
  return useMemo(() => {
    const me = s.users.find(u => u.id === s.session.userId) ?? null;
    const myWorkspaces = s.workspaces.filter(w => w.members.some(m => m.userId === me?.id));
    const workspace = myWorkspaces.find(w => w.id === s.ui.workspaceId) ?? myWorkspaces[0] ?? null;
    const projects = s.projects.filter(p => p.workspaceId === workspace?.id);
    const project = projects.find(p => p.id === s.ui.projectId) ?? projects[0] ?? null;
    const members = (workspace?.members ?? []).map(m => ({ ...m, user: s.users.find(u => u.id === m.userId)! })).filter(m => m.user);
    const myRole = workspace?.members.find(m => m.userId === me?.id)?.role ?? 'viewer';
    const kinds = new Map<string, ColumnKind>();
    s.projects.forEach(p => p.columns.forEach(c => kinds.set(p.id + ':' + c.id, c.kind)));
    const kindOf = (t: Task): ColumnKind => kinds.get(t.projectId + ':' + t.columnId) ?? 'open';
    const wsTasks = s.tasks.filter(t => projects.some(p => p.id === t.projectId));
    const userById = (id?: string) => s.users.find(u => u.id === id);
    return { s, actions, saveStatus, sync, serverInfo, me, myWorkspaces, workspace, projects, project, members, myRole, readOnly: myRole === 'viewer', kindOf, wsTasks, userById, today: today() };
  }, [s, actions, saveStatus, sync, serverInfo]);
}
