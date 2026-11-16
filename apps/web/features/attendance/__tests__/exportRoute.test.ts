import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { forbidden } from '@/server/http/errors';

const mocks = vi.hoisted(() => ({
  actor: null as Actor | null,
  timeZone: 'UTC',
  exportCsv: vi.fn(),
}));
vi.mock('@/server/runtime', () => ({
  getRuntime: () => ({ services: { attendance: { exportCsv: mocks.exportCsv }, orgs: { getCamp: async () => ({ timezone: mocks.timeZone }) } } }),
}));
vi.mock('@/server/session', () => ({ requireSession: async () => ({}), getCurrentCamp: async () => ({}), toActor: () => mocks.actor }));

const { GET } = await import('@/app/(app)/camp/attendance/export/route');

const owner: Actor = { userId: 'u1', orgId: 'o1', role: 'owner' };
const request = (query: string) => new Request(`https://camp.example.test/camp/attendance/export${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor = owner;
  mocks.timeZone = 'UTC';
  mocks.exportCsv.mockResolvedValue('name,in\r\nAda,09:12\r\n');
});

describe('GET /camp/attendance/export', () => {
  it('answers a CSV attachment named for the dates, never cached', async () => {
    const response = await GET(request('?from=2026-11-10&to=2026-11-12&personId=6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="attendance-2026-11-10-to-2026-11-12.csv"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    // Response.text() drops a byte-order mark, so read the bytes: EF BB BF, then the CSV.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('name,in\r\nAda,09:12\r\n');
  });

  it('asks the service for the filter as the actor, and passes the person on', async () => {
    await GET(request('?from=2026-11-10&to=2026-11-12&personId=6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f'));
    expect(mocks.exportCsv).toHaveBeenCalledWith(owner, { from: '2026-11-10', to: '2026-11-12', personId: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f' });
  });

  it('defaults to today in the camp zone when no dates are given', async () => {
    mocks.timeZone = 'Pacific/Auckland';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T12:30:00Z')); // 14 Nov in Auckland, 13 Nov in UTC
    try {
      await GET(request(''));
      expect(mocks.exportCsv).toHaveBeenCalledWith(owner, { from: '2026-11-14', to: '2026-11-14' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers 403 when the service refuses (no attendance:export)', async () => {
    mocks.exportCsv.mockRejectedValue(forbidden('Your role cannot do this'));
    const response = await GET(request('?from=2026-11-10&to=2026-11-12'));
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('Your role cannot do this');
  });

  it('answers 400 for dates that do not make a range, without calling the service', async () => {
    const response = await GET(request('?from=2026-11-12&to=2026-11-10'));
    expect(response.status).toBe(400);
    expect(mocks.exportCsv).not.toHaveBeenCalled();
  });

  it('answers 404 with no camp selected', async () => {
    mocks.actor = null;
    const response = await GET(request('?from=2026-11-10&to=2026-11-12'));
    expect(response.status).toBe(404);
    expect(mocks.exportCsv).not.toHaveBeenCalled();
  });

  it('rethrows an unexpected error', async () => {
    mocks.exportCsv.mockRejectedValue(new Error('database down'));
    await expect(GET(request('?from=2026-11-10&to=2026-11-12'))).rejects.toThrow('database down');
  });
});
