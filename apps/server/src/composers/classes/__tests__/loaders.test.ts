import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { forbidden } from '../../../http/errors';

const h = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn() },
  classes: {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    listClasses: vi.fn(),
    listEnrolments: vi.fn(),
  },
  people: { list: vi.fn() },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: h }) }));

const { campZone } = await import('../../attendance/campActor');
const { loadSessions, loadSessionPage, loadEnrolments, loadPeopleWithRole } = await import('../load');

const actor = {} as Actor;
const session = { id: 's1', name: 'Summer camp' } as never;
const cls = { id: 'c1', name: 'Painting' } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('campZone', () => {
  it('returns the camp timezone, never the server zone', async () => {
    h.orgs.getCamp.mockResolvedValue({ timezone: 'Europe/London' });
    expect(await campZone(actor)).toBe('Europe/London');
  });
});

describe('loadSessions', () => {
  it('wraps the sessions the service returns', async () => {
    h.classes.listSessions.mockResolvedValue({ ok: true, value: [session] });
    expect(await loadSessions(actor)).toEqual({ ok: true, value: [session] });
  });

  it('reports forbidden when the service refuses the actor', async () => {
    h.classes.listSessions.mockRejectedValue(forbidden('no access'));
    expect(await loadSessions(actor)).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('reports not-found when the service returns a failure outcome', async () => {
    h.classes.listSessions.mockResolvedValue({ ok: false, failure: { message: 'gone' } });
    expect(await loadSessions(actor)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('rethrows errors that are not HTTP errors, for the error boundary', async () => {
    h.classes.listSessions.mockRejectedValue(new Error('database down'));
    await expect(loadSessions(actor)).rejects.toThrow('database down');
  });
});

describe('loadSessionPage', () => {
  it('returns the session with its classes', async () => {
    h.classes.getSession.mockResolvedValue({ ok: true, value: session });
    h.classes.listClasses.mockResolvedValue({ ok: true, value: [cls] });
    expect(await loadSessionPage(actor, 's1')).toEqual({ ok: true, value: { session, classes: [cls] } });
  });

  it('reports not-found when the session is not in this camp', async () => {
    h.classes.getSession.mockResolvedValue({ ok: false, failure: { message: 'no session' } });
    expect(await loadSessionPage(actor, 's9')).toEqual({ ok: false, reason: 'not-found' });
    expect(h.classes.listClasses).not.toHaveBeenCalled();
  });
});

describe('loadPeopleWithRole', () => {
  it('turns people into id and display name pairs', async () => {
    h.people.list.mockResolvedValue([{ id: 'p1', givenName: 'Ada', familyName: 'Lovelace' }]);
    expect(await loadPeopleWithRole(actor, 'instructor')).toEqual({
      ok: true,
      value: [{ id: 'p1', name: 'Ada Lovelace' }],
    });
  });
});

describe('loadEnrolments', () => {
  it('reports not-found when the class cannot be read', async () => {
    h.classes.listEnrolments.mockResolvedValue({ ok: false, failure: { message: 'no class' } });
    expect(await loadEnrolments(actor, 'c1')).toEqual({ ok: false, reason: 'not-found' });
  });
});
