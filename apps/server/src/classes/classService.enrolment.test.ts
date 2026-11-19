import { describe, expect, it } from 'vitest';
import {
  CAMPER_ADA,
  CAMPER_BEN,
  CAMPER_CY,
  ORG,
  OTHER_ORG,
  as,
  classWithSession,
  monday9to12,
  monday11to13,
  painting,
  robotics,
  setup,
} from './__tests__/fixtures';

const CAMPER_DAN = '00000000-0000-4000-8000-0000000000d4';
const enrolInput = (
  sessionId: string,
  camperId: string,
  extra: { waitlistIfFull?: boolean; override?: { reason: string } } = {},
) => ({
  classId: sessionId,
  camperId,
  waitlistIfFull: extra.waitlistIfFull ?? false,
  override: extra.override,
});

describe('enrolment: age range (inclusive, checked on the camp-local day)', () => {
  it('refuses a camper below the range, with the age and the range in the reason', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2020-01-01'); // 7 on 5 July 2027
    const { classId: sessionId } = await classWithSession(service);
    const r = await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN));
    expect(r).toMatchObject({
      ok: false,
      failure: { reason: 'age_out_of_range', refusal: { age: 7, range: { minAge: 8, maxAge: 12 } } },
    });
    if (r.ok) {
      return;
    }
    expect(r.failure.message).toContain('ages 8 to 12');
    expect(r.failure.message).toContain('7');
  });

  it('accepts a camper exactly on the minimum age', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2019-07-05'); // exactly 8 on 5 July 2027
    const { classId: sessionId } = await classWithSession(service);
    expect((await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).ok).toBe(true);
  });

  it('accepts a camper exactly on the maximum age', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2015-07-05'); // exactly 12 on 5 July 2027
    const { classId: sessionId } = await classWithSession(service);
    expect((await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).ok).toBe(true);
  });

  it('refuses a camper one day over the maximum age', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2014-07-04'); // 13 on 5 July 2027
    const { classId: sessionId } = await classWithSession(service);
    expect(await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).toMatchObject({
      ok: false,
      failure: { reason: 'age_out_of_range', refusal: { age: 13 } },
    });
  });

  it('counts the age on the camp-local day: a session at 23:30 UTC is already the next day in Sydney', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2019-07-05'); // 8 on 5 July in Sydney, 7 on 4 July in UTC
    const { classId: sessionId } = await classWithSession(service, robotics, {
      startsAt: '2027-07-04T23:30:00Z',
      endsAt: '2027-07-05T02:30:00Z',
      location: 'Lab 1',
      instructorIds: [],
    });
    expect((await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).ok).toBe(true);
  });

  it('refuses a camper whose date of birth is unknown, rather than guessing', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', null);
    const { classId: sessionId } = await classWithSession(service);
    expect(await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).toMatchObject({
      ok: false,
      failure: { reason: 'age_unknown' },
    });
  });

  it('an admin override does not get past the age limit', async () => {
    const { service, repo } = setup();
    repo.seedCamper(ORG, CAMPER_DAN, 'Dan Young', '2020-01-01');
    const { classId: sessionId } = await classWithSession(service);
    const r = await service.enrol(
      as('admin'),
      enrolInput(sessionId, CAMPER_DAN, { override: { reason: 'Parent asked' } }),
    );
    expect(r).toMatchObject({ ok: false, failure: { reason: 'age_out_of_range' } });
  });
});

describe('enrolment: overlap across the camp', () => {
  it('refuses a clash and names the session it clashes with', async () => {
    const { service } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const paint = await service.addClass(as('admin'), sessionId, { ...painting, ...monday11to13 });
    if (!paint.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA))).ok).toBe(true);

    const r = await service.enrol(as('staff'), enrolInput(paint.value.id, CAMPER_ADA));
    expect(r).toMatchObject({
      ok: false,
      failure: { reason: 'overlap', refusal: { clash: { className: 'Robotics' } } },
    });
    if (r.ok) {
      return;
    }
    expect(r.failure.message).toContain('Robotics');
    expect(r.failure.message).toContain('09:00-12:00');
  });

  it('sessions that only touch do not clash', async () => {
    const { service } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const after = await service.addClass(as('admin'), sessionId, {
      ...painting,
      ...{
        ...monday11to13,
        startsAt: '2027-07-05T12:00:00+10:00',
        endsAt: '2027-07-05T13:00:00+10:00',
      },
    });
    if (!after.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA))).ok).toBe(true);
    expect((await service.enrol(as('staff'), enrolInput(after.value.id, CAMPER_ADA))).ok).toBe(true);
  });

  it('a session nested inside an enrolled one clashes with it', async () => {
    const { service } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const inner = await service.addClass(as('admin'), sessionId, {
      ...painting,
      ...{
        ...monday9to12,
        startsAt: '2027-07-05T10:00:00+10:00',
        endsAt: '2027-07-05T11:00:00+10:00',
      },
    });
    if (!inner.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA))).ok).toBe(true);
    expect(await service.enrol(as('staff'), enrolInput(inner.value.id, CAMPER_ADA))).toMatchObject({
      ok: false,
      failure: { reason: 'overlap', refusal: { clash: { className: 'Robotics' } } },
    });
  });

  it('a session that crosses midnight clashes with an enrolled session that starts after midnight', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const late = await service.addClass(as('admin'), sessionId, {
      ...robotics,
      ...monday9to12,
      startsAt: '2027-07-05T23:00:00+10:00',
      endsAt: '2027-07-06T01:00:00+10:00',
    });
    if (!late.ok) {
      throw new Error('setup');
    }
    const early = await service.addClass(as('admin'), sessionId, {
      ...painting,
      ...{
        ...monday9to12,
        startsAt: '2027-07-06T00:30:00+10:00',
        endsAt: '2027-07-06T02:00:00+10:00',
      },
    });
    if (!early.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(late.value.id, CAMPER_ADA))).ok).toBe(true);
    expect(await service.enrol(as('staff'), enrolInput(early.value.id, CAMPER_ADA))).toMatchObject({
      ok: false,
      failure: { reason: 'overlap', refusal: { clash: { sessionId: late.value.id } } },
    });
  });

  it('an admin may override with a reason, the reason is kept and the override is audit-logged', async () => {
    const { service, repo } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const paint = await service.addClass(as('admin'), sessionId, { ...painting, ...monday11to13 });
    if (!paint.ok) {
      throw new Error('setup');
    }
    await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA));

    const r = await service.enrol(
      as('admin'),
      enrolInput(paint.value.id, CAMPER_ADA, { override: { reason: 'Parent agreed to the clash' } }),
    );
    expect(r).toMatchObject({ ok: true, value: { status: 'enrolled', overrideReason: 'Parent agreed to the clash' } });
    expect(repo.audit.find(a => a.action === 'enrolment.override')).toMatchObject({
      actorId: 'user-admin',
      data: { reason: 'Parent agreed to the clash', camperId: CAMPER_ADA },
    });
  });

  it('an override with a blank reason is refused, and nothing is written', async () => {
    const { service, repo } = setup();
    const { classId: sessionId } = await classWithSession(service);
    await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA));
    const before = repo.audit.length;
    const r = await service.enrol(as('admin'), enrolInput(sessionId, CAMPER_ADA, { override: { reason: '   ' } }));
    expect(r).toMatchObject({ ok: false, failure: { reason: 'override_needs_reason' } });
    expect(repo.audit.length).toBe(before);
  });

  it('a staff member cannot override, even with a reason', async () => {
    const { service, repo } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const paint = await service.addClass(as('admin'), sessionId, { ...painting, ...monday11to13 });
    if (!paint.ok) {
      throw new Error('setup');
    }
    await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA));
    const r = await service.enrol(
      as('staff'),
      enrolInput(paint.value.id, CAMPER_ADA, { override: { reason: 'Please' } }),
    );
    expect(r).toMatchObject({ ok: false, failure: { reason: 'override_not_allowed' } });
    expect(repo.audit.some(a => a.action === 'enrolment.override')).toBe(false);
  });
});

describe('enrolment: capacity (hard limit)', () => {
  it('a full session refuses with a message that offers the waitlist', async () => {
    const { service } = setup();
    const { classId: sessionId } = await classWithSession(service);
    await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA));
    await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_BEN));
    const r = await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_CY));
    expect(r).toMatchObject({ ok: false, failure: { reason: 'session_full' } });
    if (!r.ok) {
      expect(r.failure.message).toContain('waitlist');
    }
  });

  it('waitlists instead when asked, without taking a seat', async () => {
    const { service } = setup();
    const { sessionId: parentId, classId } = await classWithSession(service);
    await service.enrol(as('staff'), enrolInput(classId, CAMPER_ADA));
    await service.enrol(as('staff'), enrolInput(classId, CAMPER_BEN));
    const r = await service.enrol(as('staff'), enrolInput(classId, CAMPER_CY, { waitlistIfFull: true }));
    expect(r).toMatchObject({ ok: true, value: { status: 'waitlisted' } });
    const listed = await service.listClasses(as('viewer'), parentId);
    expect(listed).toMatchObject({ ok: true, value: [{ seatsTaken: 2, waitlisted: 1 }] });
  });

  it('cancelling an enrolment frees the place for the next camper', async () => {
    const { service } = setup();
    const { classId: sessionId } = await classWithSession(service);
    const ada = await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA));
    await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_BEN));
    if (!ada.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_CY))).ok).toBe(false);
    expect((await service.cancelEnrolment(as('staff'), { enrolmentId: ada.value.id })).ok).toBe(true);
    expect((await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_CY))).ok).toBe(true);
  });

  it("cancelling frees the camper's time, and a second cancel is a clear failure", async () => {
    const { service } = setup();
    const { sessionId, classId: robo } = await classWithSession(service);
    const paint = await service.addClass(as('admin'), sessionId, { ...painting, ...monday11to13 });
    if (!paint.ok) {
      throw new Error('setup');
    }
    const ada = await service.enrol(as('staff'), enrolInput(robo, CAMPER_ADA));
    if (!ada.ok) {
      throw new Error('setup');
    }
    expect((await service.enrol(as('staff'), enrolInput(paint.value.id, CAMPER_ADA))).ok).toBe(false);
    expect((await service.cancelEnrolment(as('staff'), { enrolmentId: ada.value.id, note: 'Moved' })).ok).toBe(true);
    expect((await service.enrol(as('staff'), enrolInput(paint.value.id, CAMPER_ADA))).ok).toBe(true);
    expect(await service.cancelEnrolment(as('staff'), { enrolmentId: ada.value.id })).toMatchObject({
      ok: false,
      failure: { reason: 'enrolment_not_found' },
    });
  });

  it('a camper from another organisation is not found in this camp', async () => {
    const { service, repo } = setup();
    repo.seedCamper(OTHER_ORG, CAMPER_DAN, 'Dan Young', '2016-01-01');
    const { classId: sessionId } = await classWithSession(service);
    expect(await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_DAN))).toMatchObject({
      ok: false,
      failure: { reason: 'camper_not_found' },
    });
  });
});

describe('enrolment: concurrency', () => {
  it('two enrolments into the last place: exactly one succeeds, the other is told the session is full', async () => {
    const { service, repo } = setup();
    const { sessionId: parentId, classId } = await classWithSession(service, { ...robotics, capacity: 1 });
    const [a, b] = await Promise.all([
      service.enrol(as('staff'), enrolInput(classId, CAMPER_ADA)),
      service.enrol(as('staff'), enrolInput(classId, CAMPER_BEN)),
    ]);
    const outcomes = [a, b];
    expect(outcomes.filter(o => o.ok)).toHaveLength(1);
    expect(outcomes.filter(o => !o.ok && o.failure.reason === 'session_full')).toHaveLength(1);
    const listed = await service.listClasses(as('viewer'), parentId);
    expect(listed).toMatchObject({ ok: true, value: [{ seatsTaken: 1 }] });
    expect(repo.audit.filter(e => e.action === 'enrolment.create')).toHaveLength(1);
  });

  it('the same camper enrolled twice at once is recorded once', async () => {
    const { service, repo } = setup();
    const { classId: sessionId } = await classWithSession(service);
    const results = await Promise.all([
      service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA)),
      service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA)),
    ]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(repo.audit.filter(e => e.action === 'enrolment.create')).toHaveLength(1);
  });
});

describe('enrolment: audit covers every write, once', () => {
  it('an enrolment and a cancellation are each one audit entry', async () => {
    const { service, repo } = setup();
    const { classId: sessionId } = await classWithSession(service);
    const ada = await service.enrol(as('staff'), enrolInput(sessionId, CAMPER_ADA));
    if (!ada.ok) {
      throw new Error('setup');
    }
    await service.cancelEnrolment(as('staff'), { enrolmentId: ada.value.id, note: 'Sick' });
    expect(repo.audit.slice(-2).map(a => a.action)).toEqual(['enrolment.create', 'enrolment.cancel']);
    expect(repo.audit.at(-1)).toMatchObject({ data: { note: 'Sick' } });
  });
});
