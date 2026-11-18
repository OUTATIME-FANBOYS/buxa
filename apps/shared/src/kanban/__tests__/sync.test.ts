import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../seed/buildSeed';
import { createSync, serverApi, type Host, type SyncState } from '../sync';

// Sync talks to the local server only when NEXT_PUBLIC_LEGACY_SYNC=true. Without it the board stays local and makes no requests.
const host = (statuses: SyncState[]): Host => {
  const state = buildSeed();

  return {
    getState: () => state,
    commit: () => undefined,
    pending: [],
    onStatus: (s) => {
      statuses.push(s);
    },
  };
};

describe('createSync without the legacy server', () => {
  it('reports local and makes no requests', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const statuses: SyncState[] = [];
    const sync = createSync(host(statuses));
    await Promise.resolve();
    expect(statuses).toEqual(['local']);
    expect(fetchSpy).not.toHaveBeenCalled();
    sync.changed();
    sync.stop();
    vi.unstubAllGlobals();
  });
});

describe('serverApi', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('health fails when the server refuses the run secret', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }))));
    await expect(serverApi.health()).rejects.toThrow(/refused the run secret/);
  });
  it('rejects a reply that is not JSON, such as a static page', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }))));
    await expect(serverApi.getState()).rejects.toThrow(/not the Buxa server/);
  });
  it('reads the state as JSON and sends the version with a put', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => Promise.resolve((init?.method === 'PUT'
      ? new Response(JSON.stringify({ version: 3 }), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ version: 2, empty: true }), { status: 200, headers: { 'content-type': 'application/json' } }))));
    vi.stubGlobal('fetch', fetchMock);
    expect(await serverApi.getState()).toEqual({ version: 2, empty: true });
    expect(await serverApi.putState(2, {} as never)).toEqual({ status: 200, version: 3 });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/state');
  });
});
