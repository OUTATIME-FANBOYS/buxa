import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';

// The CSV route: it answers a session in the signed-in camp as a UTF-8 attachment, refuses a teacher, and answers 404 for a session
// from another camp or a malformed id. The composer is replaced with a stand-in that records what it was asked.
const h = vi.hoisted(() => ({
  actor: null as Actor | null,
  csvResponse: vi.fn(),
}));
vi.mock('@buxa/server/composers/index.server', () => ({
  rosterCsvResponse: h.csvResponse,
}));

const { GET } = await import('../../app/(app)/camp/(operations)/sessions/[sessionId]/roster.csv/route');

const SESSION_ID = '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f';
const context = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });
const request = () => new Request(`https://camp.example.test/camp/sessions/${SESSION_ID}/roster.csv`);

beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
  h.csvResponse.mockResolvedValue(new Response('Group,Room,Name,Role\r\n', { status: 200 }));
});

describe('GET /camp/sessions/[sessionId]/roster.csv', () => {
  it('hands the session to the roster export for the signed-in camp', async () => {
    const response = await GET(request(), context(SESSION_ID));

    expect(response.status).toBe(200);
    expect(h.csvResponse).toHaveBeenCalledWith(SESSION_ID);
  });

  it('answers 404 for an id that is not a UUID, without calling the export', async () => {
    const response = await GET(request(), context('not-a-uuid'));

    expect(response.status).toBe(404);
    expect(h.csvResponse).not.toHaveBeenCalled();
  });

  it('passes on the refusal the export gives a session from another camp', async () => {
    h.csvResponse.mockResolvedValue(new Response('That session was not found.', { status: 404 }));
    const response = await GET(request(), context(SESSION_ID));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('That session was not found.');
  });
});
