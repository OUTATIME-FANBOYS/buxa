/**
 * Keeps the app's data in step with the local Buxa server, when there is one.
 *
 * The server holds the shared copy; this browser holds an optimistic one. Every change made here is a pure
 * updater function. Updaters not yet accepted by the server wait in `pending`. If the server has moved on
 * (an agent wrote something, or another tab did) the server's data is fetched and the pending updaters are
 * replayed on top of it, so neither side's work is lost. Nothing here runs unless the server answers at startup.
 */
import type { AppState, HealthReply, IssuedToken, PutReply, StateReply, TokenInfo, VersionEvent } from './types';
import { pickData, type Data, DATA_KEYS, isData } from './dataSlices';

export type SyncState = 'local' | 'connecting' | 'synced' | 'offline';
export type Updater = (s: AppState) => AppState;
export interface Host { getState(): AppState; commit(s: AppState): void; pending: Updater[]; onStatus(s: SyncState, info?: { mcpUrl?: string }): void }

/* Guards for the server's replies. A reply that does not have the expected shape is an error, not a guess. */
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isHealthReply = (v: unknown): v is HealthReply => isObject(v) && typeof v.ok === 'boolean' && typeof v.mcpUrl === 'string';
const isStateReply = (v: unknown): v is StateReply => isObject(v) && typeof v.version === 'number'
  && (v.empty === undefined || typeof v.empty === 'boolean') && (v.data === undefined || isData(v.data));
const isTokenInfo = (v: unknown): v is TokenInfo => isObject(v) && typeof v.exists === 'boolean'
  && (v.createdAt === null || typeof v.createdAt === 'string') && (v.lastSeen === null || typeof v.lastSeen === 'string');
const isIssuedToken = (v: unknown): v is IssuedToken => isObject(v) && typeof v.token === 'string';
const isVersionEvent = (v: unknown): v is VersionEvent => isObject(v) && typeof v.version === 'number' && typeof v.origin === 'string';

function replyAs<T>(body: unknown, isT: (b: unknown) => b is T): T {
  if (!isT(body)) {
    throw new Error('unexpected reply from the Buxa server');
  }

  return body;
}

const clientId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 36);
/** The local server's secret, sent on every request. It comes from NEXT_PUBLIC_LEGACY_SECRET, which must match the server's BUXA_LEGACY_SECRET. */
const runSecret = process.env.NEXT_PUBLIC_LEGACY_SECRET ?? '';
const headers = { 'content-type': 'application/json', 'x-buxa-client': clientId, 'x-buxa-run-secret': runSecret };

/** The body of a reply, not yet checked. The callers pass it through a guard before using it. */
async function json(res: Response): Promise<unknown> {
  if (!(res.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('not the Buxa server');
  } // e.g. a static host answering with index.html

  const body: unknown = await res.json();

  return body;
}
export const serverApi = {
  async health(): Promise<HealthReply> {
    const res = await fetch('/api/health', { headers });
    if (!res.ok) {
      throw new Error('the Buxa server refused the run secret');
    } // a refusal is JSON too, so check the status

    return replyAs(await json(res), isHealthReply);
  },
  async getState(): Promise<StateReply> {
    return replyAs(await json(await fetch('/api/state', { headers })), isStateReply);
  },
  async putState(baseVersion: number, data: Data): Promise<PutReply> {
    const r = await fetch('/api/state', { method: 'PUT', headers, body: JSON.stringify({ baseVersion, data }) });
    const j: unknown = await r.json().catch((): unknown => ({}));

    return { status: r.status, version: isObject(j) && typeof j.version === 'number' ? j.version : undefined };
  },
  async tokenInfo(agentId: string): Promise<TokenInfo> {
    return replyAs(await json(await fetch(`/api/agents/${encodeURIComponent(agentId)}/token`, { headers })), isTokenInfo);
  },
  async issueToken(agentId: string): Promise<IssuedToken> {
    return replyAs(await json(await fetch(`/api/agents/${encodeURIComponent(agentId)}/token`, { method: 'POST', headers })), isIssuedToken);
  },
  async revokeToken(agentId: string): Promise<void> {
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/token`, { method: 'DELETE', headers });
  },
};

const sameData = (a: Data, b: Data) => DATA_KEYS.every(k => a[k] === b[k]);

/** Sync to the local server (`npm run server`) is opt-in: it runs only when NEXT_PUBLIC_LEGACY_SYNC=true. Otherwise the board is local-only. */
const SYNC_AVAILABLE = process.env.NEXT_PUBLIC_LEGACY_SYNC === 'true';

export function createSync(h: Host) {
  let version = 0; let last: Data | null = null; let chain: Promise<unknown> = Promise.resolve(); let timer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined; let events: EventSource | null = null; let stopped = false; let active = false;
  const queue = <T, >(fn: () => Promise<T>) => {
    const p = chain.then(fn, fn); chain = p.catch(() => undefined);

    return p;
  };

  /** Take the server's data and put this browser's unsent changes back on top of it. */
  const adopt = (v: number, data: Data) => {
    version = v; last = data;
    h.commit(h.pending.reduce((s, f) => f(s), { ...h.getState(), ...data }));
  };

  async function pull() {
    const r = await serverApi.getState(); if (r.empty || !r.data) {
      return;
    }
    adopt(r.version, r.data);
  }

  async function flushNow(): Promise<void> {
    if (stopped) {
      return;
    }
    const n = h.pending.length; if (!n) {
      return;
    }
    const data = pickData(h.getState());
    if (last && sameData(last, data)) {
      h.pending.splice(0, n);

      return;
    } // only per-browser settings changed
    let res; try {
      res = await serverApi.putState(version, data);
    } catch {
      h.onStatus('offline'); schedule(3000);

      return;
    }
    if (res.status === 200) {
      version = res.version!; last = data; h.pending.splice(0, n); h.onStatus('synced'); if (h.pending.length) {
        return flushNow();
      }
    } else if (res.status === 409) {
      await pull();

      return flushNow();
    } else {
      h.onStatus('offline'); schedule(3000);
    }
  }

  function schedule(ms = 250) {
    if (!active) {
      return;
    } clearTimeout(timer); timer = setTimeout(() => {
      void queue(flushNow);
    }, ms);
  }

  function listen() {
    // EventSource cannot send headers, so the secret travels as a query parameter on this one route.
    events = new EventSource(`/api/events?run_secret=${encodeURIComponent(runSecret)}`);
    events.addEventListener('version', e => {
      const raw: unknown = e.data;
      if (typeof raw !== 'string') {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isVersionEvent(parsed)) {
        return;
      }
      const { version: v, origin } = parsed;
      h.onStatus('synced');
      if (origin === clientId || v === version) {
        return;
      }
      void queue(async () => {
        try {
          await pull();
        } catch {
          h.onStatus('offline');
        }
      });
    });
    events.onerror = () => h.onStatus('offline');
  }

  async function start() {
    if (!SYNC_AVAILABLE) {
      h.onStatus('local');

      return;
    }
    h.onStatus('connecting');
    let info; try {
      info = await serverApi.health();
    } catch {
      if (!stopped) {
        h.pending.length = 0; h.onStatus('local');
      }

      return;
    }
    if (stopped) {
      return;
    }
    try {
      const r = await serverApi.getState(); if (stopped) {
        return;
      }
      if (r.empty || !r.data) { // first run: this browser's data becomes the server's
        const data = pickData(h.getState()); const put = await serverApi.putState(r.version, data);
        if (put.status === 200) {
          version = put.version!; last = data; h.pending.length = 0;
        } else {
          await pull();
        }
      } else {
        try {
          if (!localStorage.getItem('buxa.pre-sync')) {
            localStorage.setItem('buxa.pre-sync', JSON.stringify(pickData(h.getState())));
          }
        } catch { /* storage full or blocked */ }
        adopt(r.version, r.data);
      }
    } catch {
      if (!stopped) {
        h.pending.length = 0; h.onStatus('local');
      }

      return;
    }
    if (stopped) {
      return;
    }
    active = true; h.onStatus('synced', { mcpUrl: info.mcpUrl }); listen(); if (h.pending.length) {
      schedule(0);
    }
  }

  void start();

  return {
    /** Call after every local change. */
    changed: () => schedule(),
    stop() {
      stopped = true; clearTimeout(timer); clearTimeout(retry); events?.close();
    },
  };
}
