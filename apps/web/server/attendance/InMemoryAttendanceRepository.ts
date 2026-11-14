import type { Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { compareText, instant, newId, type InMemoryDatabase, type StoredCheckIn } from '../people/InMemoryDatabase';
import { AlreadyCheckedInError, MAX_LOG_ROWS, NotOnSiteError, type AttendanceQuery, type AttendanceRepository, type CheckInRecord, type NewCheckIn, type NewCheckOut } from './AttendanceRepository';

const toRecord = (v: StoredCheckIn): CheckInRecord => ({
  id: v.id,
  personId: v.personId,
  checkedInAt: v.checkedInAt,
  checkedInBy: v.checkedInBy,
  method: v.method,
  checkedOutAt: v.checkedOutAt,
  checkedOutBy: v.checkedOutBy,
  collectedByPersonId: v.collectedByPersonId,
  overrideReason: v.overrideReason,
  note: v.note,
});

/** In-memory adapter for check-ins: one open visit per person, the same errors, audit entries and ordering as Postgres. */
export class InMemoryAttendanceRepository implements AttendanceRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async openFor(orgId: string, personId: string): Promise<CheckInRecord | null> {
    const visit = this.openVisit(orgId, personId);
    return visit ? toRecord(visit) : null;
  }

  async onSite(orgId: string): Promise<CheckInRecord[]> {
    return [...this.db.checkIns.values()]
      .filter(v => v.orgId === orgId && v.checkedOutAt === null)
      .sort((a, b) => compareText(a.checkedInAt, b.checkedInAt) || compareText(a.id, b.id))
      .map(toRecord);
  }

  async checkIn(actor: Actor, input: NewCheckIn): Promise<CheckInRecord> {
    if (!this.db.inOrg(this.db.people, actor.orgId, input.personId)) throw new PersonNotFoundError();
    if (this.openVisit(actor.orgId, input.personId)) throw new AlreadyCheckedInError();
    const visit: StoredCheckIn = {
      id: newId(),
      orgId: actor.orgId,
      personId: input.personId,
      checkedInAt: instant(input.at),
      checkedInBy: actor.userId,
      method: input.method,
      checkedOutAt: null,
      checkedOutBy: null,
      collectedByPersonId: null,
      overrideReason: input.overrideReason,
      note: input.note,
    };
    this.db.checkIns.set(visit.id, visit);
    this.db.record(actor, 'attendance.check_in', 'check_in', visit.id, { personId: input.personId, method: input.method });
    if (input.overrideReason !== null) {
      this.db.record(actor, 'attendance.override', 'check_in', visit.id, { personId: input.personId, phase: 'check_in', reason: input.overrideReason });
    }
    return toRecord(visit);
  }

  async checkOut(actor: Actor, input: NewCheckOut): Promise<CheckInRecord> {
    const visit = this.openVisit(actor.orgId, input.personId);
    if (!visit) throw new NotOnSiteError();
    if (input.collectedByPersonId !== null && !this.db.inOrg(this.db.people, actor.orgId, input.collectedByPersonId)) {
      throw new PersonNotFoundError();
    }
    const at = instant(input.at);
    if (at < visit.checkedInAt) throw new Error('check-out is before check-in');
    visit.checkedOutAt = at;
    visit.checkedOutBy = actor.userId;
    visit.collectedByPersonId = input.collectedByPersonId;
    visit.overrideReason = input.overrideReason ?? visit.overrideReason;
    visit.note = input.note ?? visit.note;
    this.db.record(actor, 'attendance.check_out', 'check_in', visit.id, { personId: input.personId, collectedByPersonId: input.collectedByPersonId });
    if (input.overrideReason !== null) {
      this.db.record(actor, 'attendance.override', 'check_in', visit.id, { personId: input.personId, phase: 'check_out', reason: input.overrideReason });
    }
    return toRecord(visit);
  }

  async log(orgId: string, query: AttendanceQuery): Promise<CheckInRecord[]> {
    const from = instant(query.from);
    const to = instant(query.to);
    return [...this.db.checkIns.values()]
      .filter(v => v.orgId === orgId
        && v.checkedInAt >= from && v.checkedInAt < to
        && (query.personId === undefined || v.personId === query.personId)
        && (query.onSiteOnly !== true || v.checkedOutAt === null))
      .sort((a, b) => compareText(b.checkedInAt, a.checkedInAt) || compareText(b.id, a.id))
      .slice(0, MAX_LOG_ROWS)
      .map(toRecord);
  }

  private openVisit(orgId: string, personId: string): StoredCheckIn | undefined {
    return [...this.db.checkIns.values()].find(v => v.orgId === orgId && v.personId === personId && v.checkedOutAt === null);
  }
}
