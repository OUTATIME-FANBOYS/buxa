import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp, hostProblem, newRunSecret } from '../app';
import { AGENT_ID, CAMP_PROJECT_IDS, PROJECT, PROJECT_NAME, USER } from '@buxa/shared';
import { buildSeed } from '@buxa/shared';
import { pickData } from '@buxa/shared';
import * as A from '@buxa/shared';
import type { AppState, Data } from '@buxa/shared';
import { OutcomeBody, ProposalListBody, StateBody, TokenBody, VersionBody, WhoAmIBody } from '../types';
import { requirePresent } from '@buxa/domain';

let dir: string;
let app: ReturnType<typeof createApp>;
let base: string;
const SECRET = 'test-run-secret-0123456789';
const H = { 'content-type': 'application/json', 'x-buxa-client': 'test', 'x-buxa-run-secret': SECRET };
const api = async (method: string, p: string, b?: unknown, headers: Record<string, string> = H) => {
  const r = await fetch(base + p, { method, headers, body: b === undefined ? undefined : JSON.stringify(b) });
  const json: unknown = await r.json().catch(() => null);

  return { status: r.status, json };
};
/** GET /api/state, parsed, with the data required (the tests only read it after a first upload). */
const readState = async () => {
  const body = StateBody.parse((await api('GET', '/api/state')).json);
  if (!body.data) {
    throw new Error('the server has no data yet');
  }

  return { version: body.version, data: body.data };
};
const seed = () => pickData(buildSeed());
const start = async (d = dir) => {
  app = createApp({ dataDir: d, port: 0, secret: SECRET });
  base = `http://127.0.0.1:${await app.listen()}`;
};

async function connect(token: string) {
  const c = new Client({ name: 'test', version: '1' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(base + '/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );

  return c;
}
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  const text = r.content[0].text;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { error: !!r.isError, json, text };
};
const token = async () => TokenBody.parse((await api('POST', `/api/agents/${AGENT_ID}/token`)).json).token;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buxa-'));
  await start();
});
afterEach(async () => {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('network safety', () => {
  it('refuses requests addressed to any host other than localhost', async () => {
    const status = await new Promise<number>(res => {
      const r = http.request(
        { host: '127.0.0.1', port: new URL(base).port, path: '/api/health', headers: { host: 'evil.example' } },
        x => res(requirePresent(x.statusCode, 'x.statusCode')),
      );
      r.end();
    });
    expect(status).toBe(403);
  });
  it('refuses cross-site origins and writes without the client header', async () => {
    expect((await api('GET', '/api/health', undefined, { origin: 'https://evil.example' })).status).toBe(403);
    expect(
      (
        await api(
          'PUT',
          '/api/state',
          { baseVersion: 0, data: seed() },
          { 'content-type': 'application/json', 'x-buxa-run-secret': SECRET },
        )
      ).status,
    ).toBe(400);
  });
  it('refuses every /api request without the run secret, or with a wrong one', async () => {
    expect((await fetch(base + '/api/health')).status).toBe(401);
    expect((await api('GET', '/api/state', undefined, { 'x-buxa-run-secret': 'guess' })).status).toBe(401);
    expect((await api('POST', `/api/agents/${AGENT_ID}/token`, undefined, { 'x-buxa-client': 'test' })).status).toBe(
      401,
    );
    expect((await api('GET', '/api/health')).status).toBe(200);
  });
  it('lets the event stream take the secret as a query parameter, since EventSource cannot send headers', async () => {
    expect((await fetch(base + '/api/events?run_secret=wrong')).status).toBe(401);
    const ac = new AbortController();
    const r = await fetch(base + `/api/events?run_secret=${SECRET}`, { signal: ac.signal });
    expect(r.status).toBe(200);
    ac.abort();
  });
  it('generates a fresh run secret when none is given', () => {
    expect(newRunSecret()).not.toBe(newRunSecret());
    expect(newRunSecret().length).toBeGreaterThanOrEqual(32);
  });
  it('refuses to listen beyond loopback unless explicitly allowed', () => {
    expect(hostProblem('127.0.0.1', undefined)).toBeNull();
    expect(hostProblem('localhost', undefined)).toBeNull();
    expect(hostProblem('::1', undefined)).toBeNull();
    expect(hostProblem('0.0.0.0', undefined)).toMatch(/BUXA_ALLOW_REMOTE_HOST/);
    expect(hostProblem('192.168.1.20', 'no')).toMatch(/expose/);
    expect(hostProblem('0.0.0.0', 'yes')).toBeNull();
  });
});

describe('state sync', () => {
  it('starts empty, accepts a first upload, and rejects stale writers', async () => {
    expect((await api('GET', '/api/state')).json).toMatchObject({ empty: true, version: 0 });
    expect(VersionBody.parse((await api('PUT', '/api/state', { baseVersion: 0, data: seed() })).json).version).toBe(1);
    const stale = await api('PUT', '/api/state', { baseVersion: 0, data: seed() });
    expect(stale.status).toBe(409);
    expect(VersionBody.parse(stale.json).version).toBe(1);
    expect((await api('PUT', '/api/state', { baseVersion: 1, data: { tasks: [] } })).status).toBe(400);
  });
  it('keeps data and tokens across a restart', async () => {
    await api('PUT', '/api/state', { baseVersion: 0, data: seed() });
    const t = await token();
    await app.close();
    await start();
    expect((await readState()).version).toBe(1);
    const c = await connect(t);
    expect(WhoAmIBody.parse((await call(c, 'whoami')).json).name).toBe('Triage Agent');
    await c.close();
  });
});

describe('MCP endpoint', () => {
  beforeEach(async () => {
    await api('PUT', '/api/state', { baseVersion: 0, data: seed() });
  });

  it('requires a valid token, and a revoked token stops working', async () => {
    const bare = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: '{}',
    });
    expect(bare.status).toBe(401);
    const t = await token();
    const c = await connect(t);
    await c.close();
    await api('DELETE', `/api/agents/${AGENT_ID}/token`);
    await expect(connect(t)).rejects.toThrow();
    expect((await api('POST', '/api/agents/nobody/token')).status).toBe(404);
  });

  it('lists the tools and tells the agent what it may do', async () => {
    const c = await connect(await token());
    const names = (await c.listTools()).tools.map(x => x.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'whoami',
        'list_projects',
        'list_tasks',
        'get_task',
        'create_task',
        'update_task',
        'move_task',
        'add_comment',
        'list_my_proposals',
        'review_proposal',
      ]),
    );
    const who = WhoAmIBody.parse((await call(c, 'whoami')).json);
    expect(who.permissions).toMatchObject({ create_task: 'allowed', complete_task: 'needs approval' });
    expect(who.projects.length).toBe(CAMP_PROJECT_IDS.length);
    await c.close();
  });

  it('applies an allowed write, queues one that needs approval, and the app sees both', async () => {
    const c = await connect(await token());
    const v0 = (await readState()).version;
    const made = OutcomeBody.parse(
      (
        await call(c, 'create_task', {
          project: PROJECT_NAME.registration,
          title: 'Check cabin 4 window latch',
          column: 'Backlog',
          reason: 'Found during the cabin walk-through',
        })
      ).json,
    );
    expect(made.status).toBe('applied');
    const taskId = made.taskId ?? '';
    const moved = OutcomeBody.parse(
      (await call(c, 'move_task', { taskId, column: 'Done', reason: 'Looks finished' })).json,
    );
    expect(moved.status).toBe('pending');
    const proposalId = moved.proposalId ?? '';
    const state = await readState();
    expect(state.version).toBeGreaterThan(v0);
    const task = state.data.tasks.find(t => t.id === taskId);
    expect(task).toMatchObject({ title: 'Check cabin 4 window latch', createdBy: AGENT_ID });
    expect(task?.history[0]?.via?.reason).toBe('Found during the cabin walk-through');
    expect(state.data.proposals.find(p => p.id === proposalId)?.status).toBe('pending');
    // a person approves in the app; the agent can then see the outcome
    const approved = A.decide({ ...buildStateFrom(state.data), session: { userId: USER.rosa } }, proposalId, 'approve');
    expect((await api('PUT', '/api/state', { baseVersion: state.version, data: pickData(approved) })).status).toBe(200);
    const mine = ProposalListBody.parse((await call(c, 'list_my_proposals', { status: 'approved' })).json);
    expect(mine.map(p => p.id)).toContain(proposalId);
    await c.close();
  });

  it('keeps an agent inside its scope and reports bad input as tool errors', async () => {
    const st = await readState();
    const data: Data = { ...st.data, agents: st.data.agents.map(a => ({ ...a, scope: [PROJECT.registration] })) };
    await api('PUT', '/api/state', { baseVersion: st.version, data });
    const c = await connect(await token());
    expect((await call(c, 'list_tasks', { project: PROJECT_NAME.facilities })).error).toBe(true);
    const appTask = st.data.tasks.find(t => t.projectId === PROJECT.facilities)?.id ?? '';
    expect((await call(c, 'get_task', { taskId: appTask })).text).toMatch(/scope/);
    expect(
      (await call(c, 'create_task', { project: PROJECT.registration, title: 'x', due: 'soon', reason: 'r' })).text,
    ).toMatch(/YYYY-MM-DD/);
    expect((await call(c, 'move_task', { taskId: 't-4', column: 'Nowhere', reason: 'r' })).text).toMatch(/No column/);
    await c.close();
  });

  it('pushes a version event to the app when an agent writes', async () => {
    const events: string[] = [];
    const ac = new AbortController();
    const r = await fetch(base + `/api/events?run_secret=${SECRET}`, { signal: ac.signal });
    const reader = requirePresent(r.body, 'r.body').getReader();
    const dec = new TextDecoder();
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          events.push(dec.decode(value));
        }
      } catch {
        /* aborted */
      }
    })();
    const c = await connect(await token());
    await call(c, 'add_comment', { taskId: 't-4', body: 'hello', reason: 'testing' });
    await new Promise(r => setTimeout(r, 150));
    ac.abort();
    await pump;
    await c.close();
    expect(events.join('')).toMatch(/origin":"agent:u-agent-triage/);
  });
});

/** Rebuild a full AppState from synced data, as the app does. */
function buildStateFrom(data: Data): AppState {
  return { ...buildSeed(), ...data };
}
