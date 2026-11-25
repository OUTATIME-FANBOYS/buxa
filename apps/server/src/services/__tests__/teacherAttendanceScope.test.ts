import { describe, expect, it } from 'vitest';
import { DEFAULT_ATTENDANCE_FIELDS, type AttendanceFilter } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { classesOfSession, type LogFilterChoices } from '@buxa/shared';
import type { AttendanceFilterOptions, AttendanceQuery, CheckInRecord } from '../../attendance/AttendanceRepository';
import { InMemoryAttendanceRepository } from '../../attendance/InMemoryAttendanceRepository';
import { createClassService, type ClassService } from '../../classes/ClassService';
import type { InMemoryClassRepository } from '../../classes/InMemoryClassRepository';
import { painting, robotics, JULY_SESSION } from '../../classes/__tests__/fixtures';
import type { InMemoryDatabase } from '../../people/InMemoryDatabase';
import { createAttendanceService } from '../attendance/createAttendanceService';
import { createCamp, linkTeacher, thrown, type Camp } from './support';

/*
 * What a teacher sees on the Attendance page: the Session and Class choices, the Checked in by choice, and the log rows. Camp: a
 * July session with Robotics (taught by the teacher) and Painting (not taught by it); a Winter session with Art (not taught by it).
 * Kim is a camper in Robotics; Mo is a camper in Painting. The teacher is not an instructor of any Winter class.
 */

const FILTER: AttendanceFilter = { from: '2027-01-01', to: '2027-12-31' };
const DISPLAY = { timeZone: 'UTC', clockFormat: '24h' } as const;
const EXPORT = { filter: FILTER, fields: DEFAULT_ATTENDANCE_FIELDS, display: DISPLAY };
const ROBOTICS_TIMES = { startsAt: '2027-07-10T09:00:00Z', endsAt: '2027-07-10T12:00:00Z' };
const PAINTING_TIMES = { startsAt: '2027-07-10T13:00:00Z', endsAt: '2027-07-10T15:00:00Z' };
const ART_TIMES = { startsAt: '2027-12-02T09:00:00Z', endsAt: '2027-12-02T12:00:00Z' };

/**
 * The in-memory check-in store, with the two things it does not keep: the class (series) of a visit, and the filter's choices
 * (the in-memory store keeps no sessions or classes). Everything else is the in-memory store.
 */
class ClassAwareAttendance extends InMemoryAttendanceRepository {
  readonly classOfVisit = new Map<string, string>();
  choices: AttendanceFilterOptions = { sessions: [], classes: [] };

  constructor(db: InMemoryDatabase) {
    super(db);
  }

  override filterOptions(): Promise<AttendanceFilterOptions> {
    return Promise.resolve(this.choices);
  }

  override async log(userId: string, orgId: string, query: AttendanceQuery): Promise<CheckInRecord[]> {
    const rows = await super.log(userId, orgId, query);

    return rows.map(row => ({ ...row, classId: this.classOfVisit.get(row.id) ?? null }));
  }
}

async function build() {
  const camp: Camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher: Actor = camp.actor('teacher');
  const staff = camp.actor('staff');
  const store = camp.repos.classes as InMemoryClassRepository;
  const classes: ClassService = createClassService({
    repo: camp.repos.classes,
    timezoneOf: () => Promise.resolve('UTC'),
  });

  const unwrap = <T>(outcome: { ok: true; value: T } | { ok: false; failure: { message: string } }): T => {
    if (!outcome.ok) {
      throw new Error(outcome.failure.message);
    }

    return outcome.value;
  };
  const july = unwrap(await classes.createSession(admin, JULY_SESSION));
  const winter = unwrap(
    await classes.createSession(admin, {
      ...JULY_SESSION,
      name: 'Winter camp',
      startsOn: '2027-12-01',
      endsOn: '2027-12-14',
    }),
  );
  unwrap(await classes.publishSession(admin, july.id));
  unwrap(await classes.publishSession(admin, winter.id));
  const teacherPersonId = await linkTeacher(camp, teacher.userId);
  const addClass = async (
    cls: typeof robotics,
    sessionId: string,
    times: typeof ROBOTICS_TIMES,
    instructorIds: string[] = [],
  ) => unwrap(await classes.addClass(admin, sessionId, { ...cls, ...times, instructorIds })).id;
  const roboticsId = await addClass(robotics, july.id, ROBOTICS_TIMES, [teacherPersonId]);
  const paintingId = await addClass(painting, july.id, PAINTING_TIMES);
  const artId = await addClass({ ...painting, name: 'Art' }, winter.id, ART_TIMES);
  const seriesOf = async (dayId: string) => unwrap(await classes.getClass(admin, dayId)).seriesId;
  const [roboticsSeries, paintingSeries, artSeries] = await Promise.all([
    seriesOf(roboticsId),
    seriesOf(paintingId),
    seriesOf(artId),
  ]);

  const camper = async (givenName: string) => {
    const person = await camp.people.create(admin, { givenName, familyName: 'Camp', roles: ['participant'] });
    store.seedCamper(camp.orgId, person.id, givenName, '2015-03-01');

    return person.id;
  };
  const kim = await camper('Kim');
  const mo = await camper('Mo');
  unwrap(await classes.enrol(admin, { classId: roboticsId, camperId: kim, waitlistIfFull: false }));
  unwrap(await classes.enrol(admin, { classId: paintingId, camperId: mo, waitlistIfFull: false }));

  const repo = new ClassAwareAttendance(camp.store.database);
  repo.choices = {
    sessions: [
      { id: july.id, name: july.name },
      { id: winter.id, name: winter.name },
    ],
    classes: [
      { id: roboticsSeries, name: 'Robotics', sessionId: july.id },
      { id: paintingSeries, name: 'Painting', sessionId: july.id },
      { id: artSeries, name: 'Art', sessionId: winter.id },
    ],
  };
  const attendance = createAttendanceService({
    attendance: repo,
    classes: camp.repos.classes,
    groups: camp.repos.groups,
    people: camp.repos.people,
    memberships: camp.repos.memberships,
    orgs: camp.repos.orgs,
    clock: () => new Date('2027-07-10T12:00:00Z'),
  });

  /** One visit: checked in at `at`, with its class when it has one, then checked out. Returns the visit's id. */
  const visit = async (personId: string, sessionId: string | null, classId: string | null, at: string) => {
    const record = await repo.checkIn(admin, {
      personId,
      at,
      method: 'manual',
      overrideReason: null,
      note: null,
      sessionId,
      sessionUnassigned: false,
    });
    if (classId !== null) {
      repo.classOfVisit.set(record.id, classId);
    }
    await repo.checkOut(admin, {
      personId,
      at: `${at.slice(0, 10)}T23:00:00Z`,
      collectedByPersonId: null,
      overrideReason: null,
      note: null,
    });

    return record.id;
  };

  return {
    camp,
    admin,
    teacher,
    staff,
    attendance,
    classes,
    julyId: july.id,
    winterId: winter.id,
    roboticsSeries,
    paintingSeries,
    artSeries,
    kim,
    mo,
    visit,
  };
}

describe('teacher: the Session and Class choices are the classes it teaches', () => {
  it('lists only the sessions it teaches in', async () => {
    const { attendance, teacher, julyId } = await build();
    const choices = await attendance.filterChoices(teacher);
    expect(choices.sessions.map(s => s.id)).toEqual([julyId]);
  });

  it('lists only the classes it teaches', async () => {
    const { attendance, teacher, roboticsSeries } = await build();
    const choices = await attendance.filterChoices(teacher);
    expect(choices.classes.map(c => c.id)).toEqual([roboticsSeries]);
  });

  it('follows the chosen session: the class list shows only the teacher classes of that session', async () => {
    const { attendance, teacher, julyId, winterId, roboticsSeries } = await build();
    const choices: LogFilterChoices = await attendance.filterChoices(teacher);
    expect(classesOfSession(choices.classes, julyId).map(c => c.id)).toEqual([roboticsSeries]);
    expect(classesOfSession(choices.classes, winterId)).toEqual([]);
  });

  it('gives its Checked in by list no names (staff who checked in people outside its classes stay hidden)', async () => {
    const { attendance, teacher } = await build();
    expect((await attendance.filterChoices(teacher)).staff).toEqual([]);
  });

  it('gives a teacher with no classes empty lists', async () => {
    const camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
    const repo = new ClassAwareAttendance(camp.store.database);
    repo.choices = {
      sessions: [{ id: 'july', name: 'Summer camp' }],
      classes: [{ id: 'robotics', name: 'Robotics', sessionId: 'july' }],
    };
    const attendance = createAttendanceService({
      attendance: repo,
      classes: camp.repos.classes,
      groups: camp.repos.groups,
      people: camp.repos.people,
      memberships: camp.repos.memberships,
      orgs: camp.repos.orgs,
      clock: () => new Date('2027-07-10T12:00:00Z'),
    });
    expect(await attendance.filterChoices(camp.actor('teacher'))).toEqual({ sessions: [], classes: [], staff: [] });
  });

  it('gives staff and admin the full lists, as before', async () => {
    const { attendance, staff, admin, julyId, winterId, roboticsSeries, paintingSeries, artSeries } = await build();
    for (const actor of [staff, admin]) {
      const choices = await attendance.filterChoices(actor);
      expect(choices.sessions.map(s => s.id)).toEqual([julyId, winterId]);
      expect(choices.classes.map(c => c.id)).toEqual([roboticsSeries, paintingSeries, artSeries]);
      expect(choices.staff.length).toBeGreaterThan(0);
    }
  });
});

describe('teacher: the attendance rows are limited to the classes it teaches', () => {
  it('keeps every row for staff and admin', async () => {
    const { attendance, staff, admin, visit, kim, mo, julyId, winterId, roboticsSeries, paintingSeries, artSeries } =
      await build();
    await visit(kim, julyId, roboticsSeries, '2027-07-10T10:00:00Z');
    await visit(kim, julyId, paintingSeries, '2027-07-10T12:00:00Z');
    await visit(kim, winterId, artSeries, '2027-12-02T10:00:00Z');
    await visit(kim, null, null, '2027-07-10T14:00:00Z');
    await visit(mo, julyId, paintingSeries, '2027-07-10T15:00:00Z');
    expect((await attendance.log(staff, FILTER)).length).toBe(5);
    expect((await attendance.log(admin, FILTER)).length).toBe(5);
  });

  it('limits the rows to the teacher scope and gives no row of another class', async () => {
    const { attendance, teacher, visit, kim, mo, julyId, winterId, roboticsSeries, paintingSeries, artSeries } =
      await build();
    const own = await visit(kim, julyId, roboticsSeries, '2027-07-10T10:00:00Z');
    await visit(kim, julyId, paintingSeries, '2027-07-10T12:00:00Z');
    await visit(kim, winterId, artSeries, '2027-12-02T10:00:00Z');
    await visit(kim, null, null, '2027-07-10T14:00:00Z');
    await visit(mo, julyId, paintingSeries, '2027-07-10T15:00:00Z');
    const rows = await attendance.log(teacher, FILTER);
    expect(rows.map(r => r.id)).toEqual([own]);
  });

  it("shows a camper's history to its teacher only for the classes it teaches", async () => {
    const { attendance, teacher, visit, kim, julyId, roboticsSeries, paintingSeries } = await build();
    const own = await visit(kim, julyId, roboticsSeries, '2027-07-10T10:00:00Z');
    await visit(kim, julyId, paintingSeries, '2027-07-10T12:00:00Z');
    expect((await attendance.history(teacher, kim)).map(e => e.id)).toEqual([own]);
  });

  it('keeps the CSV export to attendance:export: a teacher is refused, an admin gets the file', async () => {
    const { attendance, teacher, admin } = await build();
    expect((await thrown(() => attendance.exportCsv(teacher, EXPORT))).statusCode).toBe(403);
    expect(await attendance.exportCsv(admin, EXPORT)).toContain(',');
  });
});
