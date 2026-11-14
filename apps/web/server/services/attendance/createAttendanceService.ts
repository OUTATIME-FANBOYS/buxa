import type { AttendanceEntry, AttendanceFilter, CheckInInput, CheckOutInput } from '@buxa/contracts';
import { can, decideCheckIn, decideCheckOut, isMinor, personAccess, toLocalDate } from '@buxa/domain';
import { encodeCsv, type CsvCell } from '../../../features/attendance/lib/csv';
import { assertAllowed } from '../../auth/authorize';
import { badRequest, notFound } from '../../http/errors';
import { isAlreadyCheckedIn, isNotOnSite, MAX_LOG_ROWS, type AttendanceQuery, type CheckInRecord } from '../../attendance/AttendanceRepository';
import { localDaysWindow } from '../shared/campDay';
import { campZone, onSiteByPerson, toSummary } from '../shared/views';
import { toEntries, authorisedCollectors, pickupOptionsFor } from './visits';
import type { AttendanceService, AttendanceServiceDeps, CheckInResult, CheckOutResult, OnSiteEntry } from './AttendanceService';

/** Wide enough to hold every visit a person can have. */
const EARLIEST = '1900-01-01T00:00:00.000Z';
const LATEST = '9999-12-31T23:59:59.999Z';

const EXPORT_HEADER: CsvCell[] = [
  'Person', 'Checked in', 'Checked in by', 'Method', 'Checked out', 'Checked out by', 'Collected by', 'Override reason', 'Note',
];

export function createAttendanceService(deps: AttendanceServiceDeps): AttendanceService {
  const { attendance, people, memberships, orgs, clock } = deps;

  /** Records for the filter's camp-local days, newest first. */
  async function recordsFor(orgId: string, filter: AttendanceFilter, timeZone: string): Promise<CheckInRecord[]> {
    const query: AttendanceQuery = { ...localDaysWindow(filter.from, filter.to, timeZone), personId: filter.personId, onSiteOnly: filter.onSiteOnly };
    return attendance.log(orgId, query);
  }

  return {
    async checkIn(actor, input: CheckInInput): Promise<CheckInResult> {
      assertAllowed(actor, 'attendance:record');
      const orgId = actor.orgId;
      const person = await people.get(orgId, input.personId);
      if (!person) throw notFound('Person not found');
      if (person.archivedAt !== null) return { ok: false, reason: 'archived' };

      const timeZone = await campZone(orgs, orgId);
      const now = clock();
      const [open, ms] = await Promise.all([attendance.openFor(orgId, input.personId), memberships.forPerson(orgId, input.personId)]);
      const decision = decideCheckIn({
        status: personAccess(ms, toLocalDate(now, timeZone)).status,
        onSiteSince: open?.checkedInAt ?? null,
        canOverride: can(actor, 'attendance:override'),
        overrideReason: input.overrideReason,
      });

      if (decision.kind === 'refuse') {
        if (decision.reason === 'already_on_site') return { ok: false, reason: 'already_on_site', since: decision.since };
        if (decision.reason === 'not_valid') return { ok: false, reason: 'not_valid', status: decision.status, canOverride: decision.canOverride };
        return { ok: false, reason: 'override_needs_reason' };
      }

      const overridden = decision.kind === 'allow_override';
      const at = now.toISOString();
      try {
        const record = await attendance.checkIn(actor, {
          personId: input.personId, at, method: input.method,
          overrideReason: decision.kind === 'allow_override' ? decision.reason : null,
          note: input.note ?? null,
        });
        const [entry] = await toEntries(deps, orgId, [record]);
        return { ok: true, entry, overridden };
      } catch (error) {
        // Another check-in won a race between the read above and this write: report it as the already-on-site answer.
        if (!isAlreadyCheckedIn(error)) throw error;
        const current = await attendance.openFor(orgId, input.personId);
        return { ok: false, reason: 'already_on_site', since: current?.checkedInAt ?? at };
      }
    },

    async checkOut(actor, input: CheckOutInput): Promise<CheckOutResult> {
      assertAllowed(actor, 'attendance:record');
      const orgId = actor.orgId;
      const person = await people.get(orgId, input.personId);
      if (!person) throw notFound('Person not found');

      const timeZone = await campZone(orgs, orgId);
      const now = clock();
      const minor = isMinor(person, toLocalDate(now, timeZone));
      const open = await attendance.openFor(orgId, input.personId);

      let collectedBy: { personId: string; canPickup: boolean } | null = null;
      if (input.collectedByPersonId !== undefined) {
        const collector = await people.get(orgId, input.collectedByPersonId);
        if (!collector) throw badRequest('Choose who is collecting from the list.');
        const authorised = await authorisedCollectors(people, orgId, input.personId);
        collectedBy = { personId: collector.id, canPickup: authorised.has(collector.id) };
      }

      const decision = decideCheckOut({
        onSite: open !== null,
        isMinor: minor,
        collectedBy,
        canOverride: can(actor, 'attendance:override'),
        overrideReason: input.overrideReason,
      });

      if (decision.kind === 'refuse') {
        if (decision.reason === 'not_on_site') return { ok: false, reason: 'not_on_site' };
        if (decision.reason === 'override_needs_reason') return { ok: false, reason: 'override_needs_reason' };
        const guardians = await pickupOptionsFor(people, orgId, input.personId);
        return { ok: false, reason: decision.reason, canOverride: decision.canOverride, guardians };
      }

      try {
        const record = await attendance.checkOut(actor, {
          personId: input.personId,
          at: now.toISOString(),
          collectedByPersonId: collectedBy?.personId ?? null,
          overrideReason: decision.kind === 'allow_override' ? decision.reason : null,
          note: input.note ?? null,
        });
        const [entry] = await toEntries(deps, orgId, [record]);
        return { ok: true, entry, overridden: decision.kind === 'allow_override' };
      } catch (error) {
        if (isNotOnSite(error)) return { ok: false, reason: 'not_on_site' };
        throw error;
      }
    },

    async onSite(actor): Promise<OnSiteEntry[]> {
      assertAllowed(actor, 'attendance:read');
      const orgId = actor.orgId;
      const records = await attendance.onSite(orgId);
      if (records.length === 0) return [];

      const timeZone = await campZone(orgs, orgId);
      const today = toLocalDate(clock(), timeZone);
      const ids = [...new Set(records.map(r => r.personId))];
      const [persons, groups, entries, onSite] = await Promise.all([
        people.getMany(orgId, ids),
        memberships.forPeople(orgId, ids),
        toEntries(deps, orgId, records),
        onSiteByPerson(attendance, orgId),
      ]);
      const byId = new Map(persons.map(p => [p.id, p] as const));

      const result: OnSiteEntry[] = [];
      for (const [index, record] of records.entries()) {
        const person = byId.get(record.personId);
        if (!person) continue;
        const minor = isMinor(person, today);
        result.push({
          entry: entries[index],
          person: toSummary(person, groups.filter(m => m.personId === person.id), onSite.has(person.id), today),
          isMinor: minor,
          pickupOptions: minor ? await pickupOptionsFor(people, orgId, person.id) : [],
        });
      }
      return result;
    },

    async log(actor, filter) {
      assertAllowed(actor, 'attendance:read');
      const orgId = actor.orgId;
      const records = await recordsFor(orgId, filter, await campZone(orgs, orgId));
      return toEntries(deps, orgId, records);
    },

    async history(actor, personId) {
      assertAllowed(actor, 'attendance:read');
      const orgId = actor.orgId;
      if (!(await people.get(orgId, personId))) throw notFound('Person not found');
      const records = await attendance.log(orgId, { from: EARLIEST, to: LATEST, personId });
      return toEntries(deps, orgId, records);
    },

    async exportCsv(actor, filter) {
      assertAllowed(actor, 'attendance:export');
      const orgId = actor.orgId;
      const records = await recordsFor(orgId, filter, await campZone(orgs, orgId));
      if (records.length >= MAX_LOG_ROWS) throw badRequest('That is too many visits to export at once. Choose a shorter date range.');
      const entries = await toEntries(deps, orgId, records);
      return encodeCsv([EXPORT_HEADER, ...entries.map(exportRow)]);
    },
  };
}

/** One visit as CSV cells. The times are instants (ISO), so a spreadsheet and a reader agree on them. */
function exportRow(e: AttendanceEntry): CsvCell[] {
  return [
    e.personName, e.checkedInAt, e.checkedInByName, e.method, e.checkedOutAt, e.checkedOutByName, e.collectedByName, e.overrideReason, e.note,
  ];
}
