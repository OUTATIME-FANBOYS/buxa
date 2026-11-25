import {
  ATTENDANCE_FIELD_LABELS,
  type AttendanceEntry,
  type AttendanceFilter,
  type CheckInInput,
  type CheckOutInput,
} from '@buxa/contracts';
import {
  can,
  decideCheckIn,
  decideCheckOut,
  isMinor,
  personAccess,
  teachesVisit,
  toLocalDate,
  type Actor,
  type LocalDate,
} from '@buxa/domain';
import { attendanceFieldValue, encodeCsv, orderFields, sessionsOpenOn } from '@buxa/shared';
import { assertAllowed } from '../../auth/authorize';
import { badRequest, notFound } from '../../http/errors';
import {
  isAlreadyCheckedIn,
  isNotOnSite,
  MAX_LOG_ROWS,
  type AttendanceQuery,
  type CheckInRecord,
} from '../../attendance/AttendanceRepository';
import { assignedTo, teacherScopeOf, type TeacherScope } from '../../classes/teacherScope';
import { localDaysWindow } from '../shared/campDay';
import { campZone, onSiteByPerson, toSummary } from '../shared/views';
import { toEntries, authorisedCollectors, pickupOptionsFor } from './visits';
import type {
  AttendanceService,
  AttendanceServiceDeps,
  CheckInResult,
  CheckOutResult,
  OnSiteEntry,
} from './AttendanceService';

/** Wide enough to hold every visit a person can have. */
const EARLIEST = '1900-01-01T00:00:00.000Z';
const LATEST = '9999-12-31T23:59:59.999Z';

export function createAttendanceService(deps: AttendanceServiceDeps): AttendanceService {
  const { attendance, classes, groups, people, memberships, orgs, clock } = deps;

  /**
   * The session a check-in names, or null for a camp-day visit. A named session must be one of the camp's. When the camp has a
   * session in progress today, a check-in must name one: a per-session check-in has to say which session the camper attends.
   */
  async function sessionOf(actor: Actor, sessionId: string | undefined, today: LocalDate): Promise<string | null> {
    const sessions = await classes.listSessions(actor.userId, actor.orgId);
    if (sessionId !== undefined) {
      if (!sessions.some(s => s.id === sessionId)) {
        throw badRequest('Choose a session from the list.');
      }

      return sessionId;
    }
    if (sessionsOpenOn(sessions, today).length > 0) {
      throw badRequest('Choose the session this camper is attending.');
    }

    return null;
  }

  /** Whether the person has an active assignment (a group and a room) in the session. */
  async function isAssignedIn(actor: Actor, sessionId: string, personId: string): Promise<boolean> {
    const assignments = await groups.listAssignments(actor.userId, actor.orgId, sessionId);

    return assignments.some(a => a.personId === personId);
  }

  /** Records for the filter's camp-local days, newest first. */
  async function recordsFor(
    actor: Pick<Actor, 'userId' | 'orgId'>,
    filter: AttendanceFilter,
    timeZone: string,
  ): Promise<CheckInRecord[]> {
    const query: AttendanceQuery = {
      ...localDaysWindow(filter.from, filter.to, timeZone),
      personId: filter.personId,
      sessionId: filter.sessionId,
      classId: filter.classId,
      method: filter.method,
      checkedInBy: filter.checkedInBy,
      onSiteOnly: filter.onSiteOnly === true || filter.status === 'on_site',
      checkedOutOnly: filter.status === 'checked_out',
    };

    return attendance.log(actor.userId, actor.orgId, query);
  }

  /**
   * Visits as the screens show them. Who collected a child is a guardian's name, so it is withheld from anyone without
   * people:read_contact (staff and above see it; a teacher does not).
   */
  async function entriesOf(actor: Actor, records: CheckInRecord[]): Promise<AttendanceEntry[]> {
    const entries = await toEntries(deps, actor, records);

    return can(actor, 'people:read_contact') ? entries : entries.map(e => ({ ...e, collectedByName: null }));
  }

  /**
   * Keeps only the records a teacher may see: its campers' visits to a session and a class it teaches (teachesVisit, the same
   * teaching rule as My classes). Null scope (not a teacher) keeps everything.
   */
  const inScope = (scope: TeacherScope | null, records: CheckInRecord[]): CheckInRecord[] =>
    scope === null ? records : records.filter(r => scope.camperIds.has(r.personId) && teachesVisit(scope.teaching, r));

  return {
    async checkInSessions(actor) {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:record', { assignedToClass: scope === null ? undefined : true });
      const timeZone = await campZone(orgs, actor);

      return sessionsOpenOn(await classes.listSessions(actor.userId, actor.orgId), toLocalDate(clock(), timeZone));
    },

    async checkIn(actor, input: CheckInInput): Promise<CheckInResult> {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:record', { assignedToClass: assignedTo(scope, input.personId) });
      const orgId = actor.orgId;
      const person = await people.get(actor.userId, orgId, input.personId);
      if (!person) {
        throw notFound('Person not found');
      }
      if (person.archivedAt !== null) {
        return { ok: false, reason: 'archived' };
      }

      const timeZone = await campZone(orgs, actor);
      const now = clock();
      const sessionId = await sessionOf(actor, input.sessionId, toLocalDate(now, timeZone));
      const sessionUnassigned = sessionId !== null && !(await isAssignedIn(actor, sessionId, input.personId));
      const [open, ms] = await Promise.all([
        attendance.openFor(actor.userId, orgId, input.personId),
        memberships.forPerson(actor.userId, orgId, input.personId),
      ]);
      const decision = decideCheckIn({
        status: personAccess(ms, toLocalDate(now, timeZone)).status,
        onSiteSince: open?.checkedInAt ?? null,
        canOverride: can(actor, 'attendance:override'),
        overrideReason: input.overrideReason,
      });

      if (decision.kind === 'refuse') {
        if (decision.reason === 'already_on_site') {
          return { ok: false, reason: 'already_on_site', since: decision.since };
        }
        if (decision.reason === 'not_valid') {
          return { ok: false, reason: 'not_valid', status: decision.status, canOverride: decision.canOverride };
        }

        return { ok: false, reason: 'override_needs_reason' };
      }

      const overridden = decision.kind === 'allow_override';
      const at = now.toISOString();
      try {
        const record = await attendance.checkIn(actor, {
          personId: input.personId,
          at,
          method: input.method,
          overrideReason: decision.kind === 'allow_override' ? decision.reason : null,
          note: input.note ?? null,
          sessionId,
          sessionUnassigned,
        });
        const [entry] = await entriesOf(actor, [record]);

        return { ok: true, entry, overridden, unassigned: sessionUnassigned };
      } catch (error) {
        // Another check-in won a race between the read above and this write: report it as the already-on-site answer.
        if (!isAlreadyCheckedIn(error)) {
          throw error;
        }
        const current = await attendance.openFor(actor.userId, orgId, input.personId);

        return { ok: false, reason: 'already_on_site', since: current?.checkedInAt ?? at };
      }
    },

    async checkOut(actor, input: CheckOutInput): Promise<CheckOutResult> {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:record', { assignedToClass: assignedTo(scope, input.personId) });
      const orgId = actor.orgId;
      const person = await people.get(actor.userId, orgId, input.personId);
      if (!person) {
        throw notFound('Person not found');
      }

      const timeZone = await campZone(orgs, actor);
      const now = clock();
      const minor = isMinor(person, toLocalDate(now, timeZone));
      const open = await attendance.openFor(actor.userId, orgId, input.personId);

      let collectedBy: { personId: string; canPickup: boolean } | null = null;
      if (input.collectedByPersonId !== undefined) {
        const collector = await people.get(actor.userId, orgId, input.collectedByPersonId);
        if (!collector) {
          throw badRequest('Choose who is collecting from the list.');
        }
        const authorised = await authorisedCollectors(people, actor, input.personId);
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
        if (decision.reason === 'not_on_site') {
          return { ok: false, reason: 'not_on_site' };
        }
        if (decision.reason === 'override_needs_reason') {
          return { ok: false, reason: 'override_needs_reason' };
        }
        // The guardians a child can be collected by are guardian names: only people:read_contact sees them.
        const guardians = can(actor, 'people:read_contact')
          ? await pickupOptionsFor(people, actor, input.personId)
          : [];

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
        const [entry] = await entriesOf(actor, [record]);

        return { ok: true, entry, overridden: decision.kind === 'allow_override' };
      } catch (error) {
        if (isNotOnSite(error)) {
          return { ok: false, reason: 'not_on_site' };
        }
        throw error;
      }
    },

    async onSite(actor): Promise<OnSiteEntry[]> {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:read', { assignedToClass: scope === null ? undefined : true });
      const orgId = actor.orgId;
      const records = inScope(scope, await attendance.onSite(actor.userId, orgId));
      if (records.length === 0) {
        return [];
      }

      const timeZone = await campZone(orgs, actor);
      const today = toLocalDate(clock(), timeZone);
      const ids = [...new Set(records.map(r => r.personId))];
      const [persons, groups, entries, onSite] = await Promise.all([
        people.getMany(actor.userId, orgId, ids),
        memberships.forPeople(actor.userId, orgId, ids),
        entriesOf(actor, records),
        onSiteByPerson(attendance, actor),
      ]);
      const byId = new Map(persons.map(p => [p.id, p] as const));

      // Minor status is contact-level (people:read_contact): viewers get null, which the screen reads as unknown.
      const seeContact = can(actor, 'people:read_contact');
      const result: OnSiteEntry[] = [];
      for (const [index, record] of records.entries()) {
        const person = byId.get(record.personId);
        if (!person) {
          continue;
        }
        const minor = seeContact ? isMinor(person, today) : null;
        result.push({
          entry: entries[index],
          person: toSummary(
            person,
            groups.filter(m => m.personId === person.id),
            onSite.has(person.id),
            today,
            true,
          ),
          isMinor: minor,
          pickupOptions: seeContact && minor === true ? await pickupOptionsFor(people, actor, person.id) : [],
        });
      }

      return result;
    },

    async log(actor, filter) {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:read', { assignedToClass: scope === null ? undefined : true });
      const records = inScope(scope, await recordsFor(actor, filter, await campZone(orgs, actor)));

      return entriesOf(actor, records);
    },

    async filterChoices(actor) {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:read', { assignedToClass: scope === null ? undefined : true });
      const options = await attendance.filterOptions(actor.userId, actor.orgId);
      if (scope !== null) {
        // A teacher chooses only from the sessions and classes it teaches. The staff list is empty: it would name staff who
        // checked in people outside those classes, and a teacher has no use for it.
        return {
          sessions: options.sessions.filter(s => scope.teaching.sessionIds.has(s.id)),
          classes: options.classes.filter(c => scope.teaching.seriesIds.has(c.id)),
          staff: [],
        };
      }
      const members = await orgs.listMembers(actor.userId, actor.orgId);

      return { ...options, staff: members.map(m => ({ id: m.id, name: m.name })) };
    },

    async history(actor, personId) {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'attendance:read', { assignedToClass: assignedTo(scope, personId) });
      const orgId = actor.orgId;
      if (!(await people.get(actor.userId, orgId, personId))) {
        throw notFound('Person not found');
      }
      const records = inScope(
        scope,
        await attendance.log(actor.userId, orgId, { from: EARLIEST, to: LATEST, personId }),
      );

      return entriesOf(actor, records);
    },

    async exportCsv(actor, request) {
      // Reading the log and exporting it are both needed: the export is for the people who may read the log, and only staff may take a file.
      assertAllowed(actor, 'attendance:read');
      assertAllowed(actor, 'attendance:export');
      const fields = orderFields(request.fields);
      if (fields.length === 0) {
        throw badRequest('Choose at least one field to download.');
      }
      const records = await recordsFor(actor, request.filter, await campZone(orgs, actor));
      if (records.length >= MAX_LOG_ROWS) {
        throw badRequest('That is too many visits to export at once. Choose a shorter date range.');
      }
      // Names the actor may not see are already blanked by entriesOf, so the CSV never carries a name the page would hide.
      const entries = await entriesOf(actor, records);
      const rows = entries.map(entry => fields.map(field => attendanceFieldValue(entry, field, request.display)));

      return encodeCsv([fields.map(field => ATTENDANCE_FIELD_LABELS[field]), ...rows]);
    },
  };
}
