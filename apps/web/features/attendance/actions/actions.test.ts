import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { badRequest, forbidden, HttpError } from '@/server/http/errors';
import type { CheckInResult, CheckOutResult, OnSiteEntry, ScanResult } from '@/server/services';

const mocks = vi.hoisted(() => ({
  campActor: vi.fn(),
  services: {
    attendance: { checkIn: vi.fn(), checkOut: vi.fn(), onSite: vi.fn() },
    credentials: { scan: vi.fn() },
    people: { list: vi.fn() },
  },
}));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: mocks.services }) }));
vi.mock('@/server/session', () => ({ requireSession: vi.fn(), getCurrentCamp: vi.fn(), toActor: vi.fn() }));
vi.mock('../lib/campActor', () => ({ campActor: mocks.campActor }));

const { checkInAction } = await import('./checkIn');
const { checkOutAction } = await import('./checkOut');
const { scanCodeAction } = await import('./scanCode');
const { searchPeopleAction } = await import('./searchPeople');

const actor: Actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
const PERSON = '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f';
const GUARDIAN = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const entry = { id: 'e1', personId: PERSON, checkedInAt: '2026-11-13T08:12:00Z' } as AttendanceEntry;
const ada: PersonSummary = { id: PERSON, givenName: 'Ada', familyName: 'Lovelace', preferredName: null, roles: ['camper'], status: 'valid', onSite: false, archived: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.campActor.mockResolvedValue(actor);
});

describe('checkInAction', () => {
  const branches: readonly [string, CheckInResult][] = [
    ['ok', { ok: true, entry, overridden: false }],
    ['ok with override', { ok: true, entry, overridden: true }],
    ['already_on_site', { ok: false, reason: 'already_on_site', since: '2026-11-13T08:12:00Z' }],
    ['not_valid, override offered', { ok: false, reason: 'not_valid', status: 'expired', canOverride: true }],
    ['not_valid, no override', { ok: false, reason: 'not_valid', status: 'none', canOverride: false }],
    ['override_needs_reason', { ok: false, reason: 'override_needs_reason' }],
    ['archived', { ok: false, reason: 'archived' }],
  ];

  it.each(branches)('passes the %s result through as ok', async (_name, result) => {
    mocks.services.attendance.checkIn.mockResolvedValue(result);
    expect(await checkInAction({ personId: PERSON, method: 'qr' })).toEqual({ kind: 'ok', value: result });
  });

  it('passes the actor and the validated input to the service', async () => {
    mocks.services.attendance.checkIn.mockResolvedValue({ ok: true, entry, overridden: true });
    await checkInAction({ personId: PERSON, method: 'search', overrideReason: 'Parent confirmed' });
    expect(mocks.services.attendance.checkIn).toHaveBeenCalledWith(actor, { personId: PERSON, method: 'search', overrideReason: 'Parent confirmed' });
  });

  it('answers forbidden when the service refuses the actor', async () => {
    mocks.services.attendance.checkIn.mockRejectedValue(forbidden('Your role cannot do this'));
    expect(await checkInAction({ personId: PERSON, method: 'qr' })).toEqual({ kind: 'forbidden', message: 'Your role cannot do this' });
  });

  it('answers invalid for a bad request from the service', async () => {
    mocks.services.attendance.checkIn.mockRejectedValue(badRequest('Bad'));
    expect(await checkInAction({ personId: PERSON, method: 'qr' })).toEqual({ kind: 'invalid', message: 'Bad' });
  });

  it('rejects bad input without calling the service', async () => {
    const outcome = await checkInAction({ personId: 'not-a-uuid', method: 'qr' });
    expect(outcome).toMatchObject({ kind: 'invalid' });
    expect(mocks.services.attendance.checkIn).not.toHaveBeenCalled();
  });

  it('rejects an unknown method without calling the service', async () => {
    expect(await checkInAction({ personId: PERSON, method: 'telepathy' })).toMatchObject({ kind: 'invalid' });
    expect(mocks.services.attendance.checkIn).not.toHaveBeenCalled();
  });

  it('rejects an override reason that is too long', async () => {
    expect(await checkInAction({ personId: PERSON, method: 'qr', overrideReason: 'x'.repeat(501) })).toMatchObject({ kind: 'invalid' });
  });

  it('answers forbidden when no camp is selected, without calling the service', async () => {
    mocks.campActor.mockResolvedValue(null);
    expect(await checkInAction({ personId: PERSON, method: 'qr' })).toEqual({ kind: 'forbidden', message: 'Choose a camp first.' });
    expect(mocks.services.attendance.checkIn).not.toHaveBeenCalled();
  });

  it('rethrows an unexpected error for the error boundary', async () => {
    mocks.services.attendance.checkIn.mockRejectedValue(new Error('database down'));
    await expect(checkInAction({ personId: PERSON, method: 'qr' })).rejects.toThrow('database down');
  });

  it('does not treat a non-HTTP error as a person error', async () => {
    mocks.services.attendance.checkIn.mockRejectedValue(new HttpError(500, 'boom'));
    await expect(checkInAction({ personId: PERSON, method: 'qr' })).rejects.toThrow('boom');
  });
});

describe('checkOutAction', () => {
  const branches: readonly [string, CheckOutResult][] = [
    ['ok', { ok: true, entry, overridden: false }],
    ['ok with override', { ok: true, entry, overridden: true }],
    ['not_on_site', { ok: false, reason: 'not_on_site' }],
    ['pickup_required, guardians listed', { ok: false, reason: 'pickup_required', canOverride: false, guardians: [{ personId: GUARDIAN, name: 'Grace', relationship: 'Parent' }] }],
    ['pickup_required, admin may override', { ok: false, reason: 'pickup_required', canOverride: true, guardians: [] }],
    ['pickup_not_authorised', { ok: false, reason: 'pickup_not_authorised', canOverride: true, guardians: [] }],
    ['override_needs_reason', { ok: false, reason: 'override_needs_reason' }],
  ];

  it.each(branches)('passes the %s result through as ok', async (_name, result) => {
    mocks.services.attendance.checkOut.mockResolvedValue(result);
    expect(await checkOutAction({ personId: PERSON })).toEqual({ kind: 'ok', value: result });
  });

  it('passes the chosen guardian and reason to the service', async () => {
    mocks.services.attendance.checkOut.mockResolvedValue({ ok: true, entry, overridden: false });
    await checkOutAction({ personId: PERSON, collectedByPersonId: GUARDIAN });
    expect(mocks.services.attendance.checkOut).toHaveBeenCalledWith(actor, { personId: PERSON, collectedByPersonId: GUARDIAN });
  });

  it('answers forbidden when the service refuses the actor', async () => {
    mocks.services.attendance.checkOut.mockRejectedValue(forbidden('Your role cannot do this'));
    expect(await checkOutAction({ personId: PERSON })).toEqual({ kind: 'forbidden', message: 'Your role cannot do this' });
  });

  it('answers invalid for a bad guardian id, without calling the service', async () => {
    expect(await checkOutAction({ personId: PERSON, collectedByPersonId: 'Grace' })).toMatchObject({ kind: 'invalid' });
    expect(mocks.services.attendance.checkOut).not.toHaveBeenCalled();
  });

  it('answers forbidden with no camp selected', async () => {
    mocks.campActor.mockResolvedValue(null);
    expect(await checkOutAction({ personId: PERSON })).toMatchObject({ kind: 'forbidden' });
  });
});

describe('scanCodeAction', () => {
  it('answers one neutral unknown for a code that is not a person', async () => {
    mocks.services.credentials.scan.mockResolvedValue({ kind: 'unknown' } satisfies ScanResult);
    expect(await scanCodeAction({ raw: 'bx1.nonsense' })).toEqual({ kind: 'ok', value: { kind: 'unknown' } });
    expect(mocks.services.attendance.onSite).not.toHaveBeenCalled();
  });

  it('answers the person with their arrival time when they are on site', async () => {
    mocks.services.credentials.scan.mockResolvedValue({ kind: 'person', person: { ...ada, onSite: true } });
    mocks.services.attendance.onSite.mockResolvedValue([{ entry, person: ada, isMinor: true, pickupOptions: [] } satisfies OnSiteEntry]);
    expect(await scanCodeAction({ raw: 'bx1.token' })).toEqual({
      kind: 'ok',
      value: { kind: 'person', card: { person: { ...ada, onSite: true }, onSiteSince: '2026-11-13T08:12:00Z' } },
    });
  });

  it('answers the person with no arrival time when they are not on site', async () => {
    mocks.services.credentials.scan.mockResolvedValue({ kind: 'person', person: ada });
    mocks.services.attendance.onSite.mockResolvedValue([]);
    expect(await scanCodeAction({ raw: 'bx1.token' })).toEqual({ kind: 'ok', value: { kind: 'person', card: { person: ada, onSiteSince: null } } });
  });

  it('rejects a code longer than the limit', async () => {
    expect(await scanCodeAction({ raw: 'x'.repeat(501) })).toMatchObject({ kind: 'invalid' });
    expect(mocks.services.credentials.scan).not.toHaveBeenCalled();
  });

  it('answers forbidden when the service refuses the actor', async () => {
    mocks.services.credentials.scan.mockRejectedValue(forbidden('no'));
    expect(await scanCodeAction({ raw: 'bx1.x' })).toEqual({ kind: 'forbidden', message: 'no' });
  });
});

describe('searchPeopleAction', () => {
  it('finds nobody for an empty query, without calling the service', async () => {
    expect(await searchPeopleAction({ query: '   ' })).toEqual({ kind: 'ok', value: [] });
    expect(mocks.services.people.list).not.toHaveBeenCalled();
  });

  it('searches by the trimmed query and caps the answer at 20', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...ada, id: `p${i}` }));
    mocks.services.people.list.mockResolvedValue(many);
    mocks.services.attendance.onSite.mockResolvedValue([]);
    const outcome = await searchPeopleAction({ query: '  ada ' });
    expect(mocks.services.people.list).toHaveBeenCalledWith(actor, { query: 'ada' });
    expect(outcome.kind === 'ok' && outcome.value).toHaveLength(20);
  });

  it('rejects a query longer than the limit', async () => {
    expect(await searchPeopleAction({ query: 'x'.repeat(81) })).toMatchObject({ kind: 'invalid' });
  });

  it('answers forbidden when the actor may not read people', async () => {
    mocks.services.people.list.mockRejectedValue(forbidden('no'));
    expect(await searchPeopleAction({ query: 'ada' })).toEqual({ kind: 'forbidden', message: 'no' });
  });
});
