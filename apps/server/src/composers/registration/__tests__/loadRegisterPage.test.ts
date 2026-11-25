import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';

/*
 * The take-a-registration loader offers one choice per series of each session, with the series' active days. A cancelled day is
 * not a day of the series a family can be checked against, and a series with a flagged day is not offered.
 */

const h = vi.hoisted(() => ({
  registration: { getForm: vi.fn(), publishedVersion: vi.fn() },
  classes: { getSession: vi.fn(), listSeries: vi.fn(), listSeriesOccurrences: vi.fn() },
  people: { list: vi.fn() },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: h }) }));

const { loadRegisterPage } = await import('../loadRegistration');

const actor = {} as Actor;

const series = (id: string, name: string) =>
  ({
    id,
    sessionId: 's1',
    sessionName: 'Art',
    name,
    ageRange: { minAge: 6, maxAge: 12 },
    capacity: 10,
    location: 'Hall',
    weekdays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '11:00',
    firstDay: '2027-07-05',
    lastDay: '2027-07-09',
    startsLocal: '2027-07-05T09:00',
    endsLocal: '2027-07-09T11:00',
    occurrenceCount: 5,
    activeOccurrenceCount: 4,
    anchorClassId: `${id}-day-1`,
    instructorIds: [],
    instructors: [],
    price: null,
    seatsTaken: 0,
    waitlisted: 0,
  }) as never;

const day = (id: string, status: 'active' | 'cancelled', datesOutsideSession = false) =>
  ({
    id,
    startsAt: `2027-07-0${id.length}T09:00:00Z`,
    endsAt: `2027-07-0${id.length}T11:00:00Z`,
    occurrenceStatus: status,
    datesOutsideSession,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.registration.getForm.mockResolvedValue({ id: 'form-1' });
  h.registration.publishedVersion.mockResolvedValue({
    version: 1,
    fields: [],
    sessions: [{ id: 's1', name: 'Art' }],
  });
  h.classes.getSession.mockResolvedValue({ ok: true, value: { status: 'live' } });
  h.people.list.mockResolvedValue([]);
});

describe('loadRegisterPage: series, not days', () => {
  it('offers each series once, with its active days and not its cancelled ones', async () => {
    h.classes.listSeries.mockResolvedValue({ ok: true, value: [series('ser-a', 'Art Camp')] });
    h.classes.listSeriesOccurrences.mockResolvedValue({
      ok: true,
      value: [day('a-1', 'active'), day('a-2', 'active'), day('a-3', 'cancelled')],
    });

    const loaded = await loadRegisterPage(actor, 'form-1');

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error('expected the page to load');
    }
    const [session] = loaded.value.sessions;
    expect(session?.series.map(s => s.name)).toEqual(['Art Camp']);
    expect(session?.series[0]?.anchorClassId).toBe('ser-a-day-1');
    expect(session?.series[0]?.occurrences).toHaveLength(2);
    expect(h.classes.listSeries).toHaveBeenCalledTimes(1);
  });

  it('does not offer a series with a day flagged for its dates, and keeps the other series', async () => {
    h.classes.listSeries.mockResolvedValue({
      ok: true,
      value: [series('ser-flagged', 'Flagged'), series('ser-ok', 'Clear')],
    });
    h.classes.listSeriesOccurrences.mockImplementation((_actor: Actor, seriesId: string) =>
      seriesId === 'ser-flagged'
        ? { ok: true, value: [day('f-1', 'active', true)] }
        : { ok: true, value: [day('c-1', 'active')] },
    );

    const loaded = await loadRegisterPage(actor, 'form-1');

    if (!loaded.ok) {
      throw new Error('expected the page to load');
    }
    expect(loaded.value.sessions[0]?.series.map(s => s.name)).toEqual(['Clear']);
  });

  it('does not offer a series with no active day left', async () => {
    h.classes.listSeries.mockResolvedValue({ ok: true, value: [series('ser-gone', 'Cancelled')] });
    h.classes.listSeriesOccurrences.mockResolvedValue({ ok: true, value: [day('g-1', 'cancelled')] });

    const loaded = await loadRegisterPage(actor, 'form-1');

    if (!loaded.ok) {
      throw new Error('expected the page to load');
    }
    expect(loaded.value.sessions[0]?.series).toEqual([]);
  });
});
