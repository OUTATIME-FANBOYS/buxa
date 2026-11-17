import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { forbidden } from '../../../http/errors';

const h = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn() },
  classes: { listClasses: vi.fn(), getClass: vi.fn(), listSessions: vi.fn(), listEnrolments: vi.fn() },
  people: { list: vi.fn() },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: h }) }));

const { campZone } = await import('../../attendance/campActor');
const { loadClasses, loadClassPage, loadEnrolments, loadPeopleWithRole } = await import('../load');

const actor = {} as Actor;
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

describe('loadClasses', () => {
  it('wraps the classes the service returns', async () => {
    h.classes.listClasses.mockResolvedValue({ ok: true, value: [cls] });
    expect(await loadClasses(actor)).toEqual({ ok: true, value: [cls] });
  });

  it('reports forbidden when the service refuses the actor', async () => {
    h.classes.listClasses.mockRejectedValue(forbidden('no access'));
    expect(await loadClasses(actor)).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('reports not-found when the service returns a failure outcome', async () => {
    h.classes.listClasses.mockResolvedValue({ ok: false, failure: { message: 'gone' } });
    expect(await loadClasses(actor)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('rethrows errors that are not HTTP errors, for the error boundary', async () => {
    h.classes.listClasses.mockRejectedValue(new Error('database down'));
    await expect(loadClasses(actor)).rejects.toThrow('database down');
  });
});

describe('loadClassPage', () => {
  it('returns the class with its sessions', async () => {
    h.classes.getClass.mockResolvedValue({ ok: true, value: cls });
    h.classes.listSessions.mockResolvedValue({ ok: true, value: [] });
    expect(await loadClassPage(actor, 'c1')).toEqual({ ok: true, value: { cls, sessions: [] } });
  });

  it('reports not-found when the class is not in this camp', async () => {
    h.classes.getClass.mockResolvedValue({ ok: false, failure: { message: 'no class' } });
    expect(await loadClassPage(actor, 'c9')).toEqual({ ok: false, reason: 'not-found' });
    expect(h.classes.listSessions).not.toHaveBeenCalled();
  });
});

describe('loadPeopleWithRole', () => {
  it('turns people into id and display name pairs', async () => {
    h.people.list.mockResolvedValue([{ id: 'p1', givenName: 'Ada', familyName: 'Lovelace' }]);
    expect(await loadPeopleWithRole(actor, 'instructor' as never)).toEqual({ ok: true, value: [{ id: 'p1', name: 'Ada Lovelace' }] });
  });
});

describe('loadEnrolments', () => {
  it('reports not-found when the session cannot be read', async () => {
    h.classes.listEnrolments.mockResolvedValue({ ok: false, failure: { message: 'no session' } });
    expect(await loadEnrolments(actor, 's1')).toEqual({ ok: false, reason: 'not-found' });
  });
});
