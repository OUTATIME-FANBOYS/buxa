import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../app';
import { AGENT_ID, CAMP_PROJECT_IDS, PROJECT, PROJECT_NAME, USER, buildSeed } from '../../features/kanban/lib/seed';
import { pickData } from '../../features/kanban/lib/dataSlices';
import * as A from '../../features/kanban/lib/agents';
import type { AppState } from '../../features/kanban/types';

let dir: string; let app: ReturnType<typeof createApp>; let base: string;
const H = { 'content-type': 'application/json', 'x-buxa-client': 'test' };
const api = async (method: string, p: string, b?: unknown, headers: Record<string, string> = H) => {
  const r = await fetch(base + p, { method, headers, body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, json: (await r.json().catch(() => null)) as any };
};
const seed = () => pickData(buildSeed());
const start = async (d = dir) => { app = createApp({ dataDir: d, port: 0 }); base = `http://127.0.0.1:${await app.listen()}`; };
async function connect(token: string) {
  const c = new Client({ name: 'test', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${token}` } } })); return c;
}
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  const text = r.content[0].text; let json: any; try { json = JSON.parse(text); } catch { json = text; } return { error: !!r.isError, json, text };
};
const token = async () => (await api('POST', `/api/agents/${AGENT_ID}/token`)).json.token as string;

beforeEach(async () => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buxa-')); await start(); });
afterEach(async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('network safety', () => {
  it('refuses requests addressed to any host other than localhost', async () => {
    const status = await new Promise<number>(res => { const r = http.request({ host: '127.0.0.1', port: new URL(base).port, path: '/api/health', headers: { host: 'evil.example' } }, x => res(x.statusCode!)); r.end(); });
    expect(status).toBe(403);
  });
  it('refuses cross-site origins and writes without the client header', async () => {
    expect((await api('GET', '/api/health', undefined, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await api('PUT', '/api/state', { baseVersion: 0, data: seed() }, { 'content-type': 'application/json' })).status).toBe(400);
  });
});

describe('state sync', () => {
  it('starts empty, accepts a first upload, and rejects stale writers', async () => {
    expect((await api('GET', '/api/state')).json).toMatchObject({ empty: true, version: 0 });
    expect((await api('PUT', '/api/state', { baseVersion: 0, data: seed() })).json.version).toBe(1);
    const stale = await api('PUT', '/api/state', { baseVersion: 0, data: seed() });
    expect(stale.status).toBe(409); expect(stale.json.version).toBe(1);
    expect((await api('PUT', '/api/state', { baseVersion: 1, data: { tasks: [] } })).status).toBe(400);
  });
  it('keeps data and tokens across a restart', async () => {
    await api('PUT', '/api/state', { baseVersion: 0, data: seed() }); const t = await token();
    await app.close(); await start();
    expect((await api('GET', '/api/state')).json.version).toBe(1);
    const c = await connect(t); expect((await call(c, 'whoami')).json.name).toBe('Triage Agent'); await c.close();
  });
});

describe('MCP endpoint', () => {
  beforeEach(async () => { await api('PUT', '/api/state', { baseVersion: 0, data: seed() }); });

  it('requires a valid token, and a revoked token stops working', async () => {
    const bare = await fetch(base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(bare.status).toBe(401);
    const t = await token(); const c = await connect(t); await c.close();
    await api('DELETE', `/api/agents/${AGENT_ID}/token`);
    await expect(connect(t)).rejects.toThrow();
    expect((await api('POST', '/api/agents/nobody/token')).status).toBe(404);
  });

  it('lists the tools and tells the agent what it may do', async () => {
    const c = await connect(await token());
    const names = (await c.listTools()).tools.map(x => x.name);
    expect(names).toEqual(expect.arrayContaining(['whoami', 'list_projects', 'list_tasks', 'get_task', 'create_task', 'update_task', 'move_task', 'add_comment', 'list_my_proposals', 'review_proposal']));
    const who = (await call(c, 'whoami')).json;
    expect(who.permissions).toMatchObject({ create_task: 'allowed', complete_task: 'needs approval' }); expect(who.projects.length).toBe(CAMP_PROJECT_IDS.length);
    await c.close();
  });

  it('applies an allowed write, queues one that needs approval, and the app sees both', async () => {
    const c = await connect(await token()); const v0 = (await api('GET', '/api/state')).json.version;
    const made = await call(c, 'create_task', { project: PROJECT_NAME.registration, title: 'Check cabin 4 window latch', column: 'Backlog', reason: 'Found during the cabin walk-through' });
    expect(made.json.status).toBe('applied');
    const moved = await call(c, 'move_task', { taskId: made.json.taskId, column: 'Done', reason: 'Looks finished' });
    expect(moved.json.status).toBe('pending');
    const state = (await api('GET', '/api/state')).json; expect(state.version).toBeGreaterThan(v0);
    const task = state.data.tasks.find((t: any) => t.id === made.json.taskId);
    expect(task).toMatchObject({ title: 'Check cabin 4 window latch', createdBy: AGENT_ID }); expect(task.history[0].via.reason).toBe('Found during the cabin walk-through');
    expect(state.data.proposals.find((p: any) => p.id === moved.json.proposalId).status).toBe('pending');
    // a person approves in the app; the agent can then see the outcome
    const approved = A.decide({ ...buildStateFrom(state.data), session: { userId: USER.rosa } }, moved.json.proposalId, 'approve');
    expect((await api('PUT', '/api/state', { baseVersion: state.version, data: pickData(approved) })).status).toBe(200);
    const mine = (await call(c, 'list_my_proposals', { status: 'approved' })).json; expect(mine.map((p: any) => p.id)).toContain(moved.json.proposalId);
    await c.close();
  });

  it('keeps an agent inside its scope and reports bad input as tool errors', async () => {
    const st = (await api('GET', '/api/state')).json; const data = { ...st.data, agents: st.data.agents.map((a: any) => ({ ...a, scope: [PROJECT.registration] })) };
    await api('PUT', '/api/state', { baseVersion: st.version, data });
    const c = await connect(await token());
    expect((await call(c, 'list_tasks', { project: PROJECT_NAME.facilities })).error).toBe(true);
    const appTask = st.data.tasks.find((t: any) => t.projectId === PROJECT.facilities).id;
    expect((await call(c, 'get_task', { taskId: appTask })).text).toMatch(/scope/);
    expect((await call(c, 'create_task', { project: PROJECT.registration, title: 'x', due: 'soon', reason: 'r' })).text).toMatch(/YYYY-MM-DD/);
    expect((await call(c, 'move_task', { taskId: 't-4', column: 'Nowhere', reason: 'r' })).text).toMatch(/No column/);
    await c.close();
  });

  it('pushes a version event to the app when an agent writes', async () => {
    const events: string[] = []; const ac = new AbortController();
    const r = await fetch(base + '/api/events', { signal: ac.signal }); const reader = r.body!.getReader(); const dec = new TextDecoder();
    const pump = (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; events.push(dec.decode(value)); } } catch { /* aborted */ } })();
    const c = await connect(await token()); await call(c, 'add_comment', { taskId: 't-4', body: 'hello', reason: 'testing' });
    await new Promise(r => setTimeout(r, 150)); ac.abort(); await pump; await c.close();
    expect(events.join('')).toMatch(/origin":"agent:u-agent-triage/);
  });
});

/** Rebuild a full AppState from synced data, as the app does. */
function buildStateFrom(data: any): AppState { return { ...buildSeed(), ...data }; }
