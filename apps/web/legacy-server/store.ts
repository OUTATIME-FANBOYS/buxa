import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppState } from '../features/kanban/types';
import { isData, pickData, repairData, type Data } from '../features/kanban/lib/dataSlices';

/** Atomic, debounced JSON file writer: a crash mid-write can never leave a half-written file. */
class JsonFile<T> {
  private timer: NodeJS.Timeout | null = null; private pending: T | undefined;
  constructor(readonly file: string) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
  read(): T | null { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')) as T; } catch { return null; } }
  write(value: T) { this.pending = value; this.timer ??= setTimeout(() => this.flush(), 150); }
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.pending === undefined) return;
    const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.pending), { mode: 0o600 }); fs.renameSync(tmp, this.file); this.pending = undefined;
  }
}

const EMPTY_UI: AppState['ui'] = { workspaceId: '', projectId: '', view: 'board', theme: 'system', sidebarCollapsed: false, agentsEnabled: true };

/** The server's copy of the work. Single-threaded, so each `mutate` is atomic with respect to every other request. */
export class Store {
  private state: AppState | null = null; version = 0;
  private listeners = new Set<(version: number, origin: string) => void>();
  private disk: JsonFile<{ version: number; data: Data }>;
  constructor(dir: string) {
    this.disk = new JsonFile(path.join(dir, 'state.json'));
    const saved = this.disk.read();
    if (saved && isData(saved.data)) { this.version = saved.version; this.state = this.build(saved.data); }
  }
  private build(data: Data): AppState { return { version: 1, ...repairData(data), session: { userId: null }, ui: EMPTY_UI }; }
  get hasData() { return this.state !== null; }
  get data(): Data | null { return this.state ? pickData(this.state) : null; }
  get snapshot(): AppState | null { return this.state; }
  /** Replace the data, but only if the caller started from the current version. Returns the new version, or null on conflict. */
  put(baseVersion: number, data: Data, origin: string): number | null {
    if (baseVersion !== this.version) return null;
    this.state = this.build(data); return this.commit(origin);
  }
  /** Apply a pure update to the state. Returns the new version, or the current one if nothing changed. */
  mutate(fn: (s: AppState) => AppState, origin: string): number {
    if (!this.state) return this.version;
    const next = fn(this.state); if (next === this.state) return this.version;
    this.state = { ...next, session: { userId: null }, ui: EMPTY_UI }; return this.commit(origin);
  }
  private commit(origin: string) {
    this.version += 1; this.disk.write({ version: this.version, data: pickData(this.state!) });
    this.listeners.forEach(l => l(this.version, origin)); return this.version;
  }
  subscribe(l: (version: number, origin: string) => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  flush() { this.disk.flush(); }
}

/** One bearer token per agent. Only a hash is stored, so the file is useless to anyone who reads it. */
interface TokenRec { hash: string; createdAt: string; lastSeen?: string }
export class Tokens {
  private disk: JsonFile<Record<string, TokenRec>>; private byAgent: Record<string, TokenRec>;
  constructor(dir: string) { this.disk = new JsonFile(path.join(dir, 'tokens.json')); this.byAgent = this.disk.read() ?? {}; }
  private static hash = (t: string) => createHash('sha256').update(t).digest('hex');
  /** Issues a new token, replacing any earlier one. The plain token is returned once and never stored. */
  issue(agentId: string): string {
    const token = 'bxa_' + randomBytes(32).toString('base64url');
    this.byAgent[agentId] = { hash: Tokens.hash(token), createdAt: new Date().toISOString() }; this.disk.write(this.byAgent); return token;
  }
  revoke(agentId: string) { delete this.byAgent[agentId]; this.disk.write(this.byAgent); }
  info(agentId: string) { const r = this.byAgent[agentId]; return r ? { exists: true, createdAt: r.createdAt, lastSeen: r.lastSeen ?? null } : { exists: false, createdAt: null, lastSeen: null }; }
  /** Which agent does this token belong to? */
  verify(token: string): string | null {
    const h = Buffer.from(Tokens.hash(token), 'hex');
    for (const [agentId, r] of Object.entries(this.byAgent)) {
      const k = Buffer.from(r.hash, 'hex');
      if (k.length === h.length && timingSafeEqual(k, h)) {
        const now = Date.now(); if (!r.lastSeen || now - Date.parse(r.lastSeen) > 30_000) { r.lastSeen = new Date(now).toISOString(); this.disk.write(this.byAgent); }
        return agentId;
      }
    }
    return null;
  }
  flush() { this.disk.flush(); }
}
