import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../seed/buildSeed';
import { createSync, serverApi, type Host, type SyncState, type Updater } from '../sync';
import type { Data } from '../dataSlices';
import { settle } from '@buxa/domain';

// Sync talks to the local server only when NEXT_PUBLIC_LEGACY_SYNC=true. Without it the board stays local and makes no requests.
const host = (statuses: SyncState[]): Host => {
  const state = buildSeed();

  return {
    getState: () => state,
    commit: () => undefined,
    pending: [],
    onStatus: s => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn(() => settle(() => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }))),
    );
    await expect(serverApi.health()).rejects.toThrow(/refused the run secret/);
  });
  it('rejects a reply that is not JSON, such as a static page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        settle(() => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })),
      ),
    );
    await expect(serverApi.getState()).rejects.toThrow(/not the Buxa server/);
  });
  it('reads the state as JSON and sends the version with a put', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      settle(() =>
        init?.method === 'PUT'
          ? new Response(JSON.stringify({ version: 3 }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : new Response(JSON.stringify({ version: 2, empty: true }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await serverApi.getState()).toEqual({ version: 2, empty: true });
    expect(await serverApi.putState(2, {} as never)).toEqual({ status: 200, version: 3 });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/state');
  });
});

describe('createSync first run (legacy server, server has no state yet)', () => {
  // Each test loads sync fresh, because it reads NEXT_PUBLIC_LEGACY_SYNC when the module loads.
  const loadSync = async () => {
    vi.resetModules();

    return import('../sync');
  };
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const renameFirstTask =
    (title: string): Updater =>
    s => ({ ...s, tasks: s.tasks.map((t, i) => (i === 0 ? { ...t, title } : t)) });

  /** A fake server whose PUTs wait until the test answers them, so the test controls when each one lands. */
  function fakeServer() {
    const puts: { body: { baseVersion: number; data: Data }; reply: (version: number) => void }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/health') {
          return settle(() => json({ ok: true, mcpUrl: 'http://localhost/mcp' }));
        }
        if (url === '/api/state' && init?.method === 'PUT') {
          return new Promise<Response>(resolve => {
            puts.push({
              body: JSON.parse(typeof init.body === 'string' ? init.body : '{}') as { baseVersion: number; data: Data },
              reply: version =>
                resolve(
                  new Response(JSON.stringify({ version }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                  }),
                ),
            });
          });
        }

        return settle(() => json({ version: 1, empty: true }));
      }),
    );

    return puts;
  }

  /** A host whose edits go through `edit`, the way the app applies a change: queue it in `pending` and commit it to the state. */
  function setup() {
    let state = buildSeed();
    const pending: Updater[] = [];
    const statuses: SyncState[] = [];
    const host: Host = {
      getState: () => state,
      commit: s => {
        state = s;
      },
      pending,
      onStatus: s => {
        statuses.push(s);
      },
    };
    const edit = (u: Updater) => {
      pending.push(u);
      state = u(state);
    };

    return { host, pending, statuses, edit };
  }

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_LEGACY_SYNC', 'true');
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener() {}
        close() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps an edit made while the first-run PUT is in flight and sends it in a later PUT', async () => {
    const puts = fakeServer();
    const { createSync: create } = await loadSync();
    const { host, pending, statuses, edit } = setup();
    edit(renameFirstTask('before'));
    const sync = create(host);
    await vi.waitFor(() => expect(puts).toHaveLength(1));

    edit(renameFirstTask('during'));
    puts[0].reply(2);
    await vi.waitFor(() => expect(puts).toHaveLength(2));

    expect(puts[0].body.data.tasks[0].title).toBe('before');
    expect(puts[1].body.data.tasks[0].title).toBe('during');
    expect(puts[1].body.baseVersion).toBe(2);
    puts[1].reply(3);
    await vi.waitFor(() => expect(pending).toHaveLength(0));
    await vi.waitFor(() => expect(statuses.at(-1)).toBe('synced'));
    sync.stop();
  });

  it('clears the edits that the first-run PUT sent, and sends nothing more', async () => {
    const puts = fakeServer();
    const { createSync: create } = await loadSync();
    const { host, pending, statuses, edit } = setup();
    edit(renameFirstTask('only'));
    const sync = create(host);
    await vi.waitFor(() => expect(puts).toHaveLength(1));

    puts[0].reply(2);
    await vi.waitFor(() => expect(statuses.at(-1)).toBe('synced'));

    expect(pending).toHaveLength(0);
    expect(puts).toHaveLength(1);
    sync.stop();
  });
});
