import { decideEnrolment, describeRefusal, holdExpiresAt, isUuid, toLocalDate, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import { activeFactsFor } from '../classes/PgClassQueries';
import { isClassError, isEnrolmentRefusal } from '../classes/errors';
import { countTaken, enrolInTransaction, insertEnrolment, lockCamper, lockClass } from '../classes/PgEnrolmentWrites';
import { placeHoldInTransaction, releaseExpiredHoldsInSession } from '../holds/PgSeatHoldWrites';
import { RegistrationClassNotFoundError, RegistrationRefusedError } from './errors';
import type { ClassLookup, NewRegistration } from './RegistrationRepository';

/*
 * The child-and-class places of a registration (decision: families register for classes). Each place is taken under the same locks
 * as an enrolment (the camper's row, then the class's row, see PgEnrolmentWrites), with the same rule (decideEnrolment). A place that
 * is free at submission is held for the household (seat_holds, 15 minutes). A full class puts the child on its waitlist: a waitlist
 * enrolment, in the order they joined. Confirmation releases each hold as 'completed' and creates the enrolment.
 * Everything here runs inside the caller's transaction (withOrg), so a refused place leaves nothing behind.
 */

type Selection = NewRegistration['selections'][number];

/** The camp's time zone, which decides the day a session's age is taken on. */
async function timeZoneInTx(db: Db, orgId: string): Promise<string> {
  const { rows } = await db.query<{ timezone: string }>('SELECT timezone FROM orgs WHERE id = $1', [orgId]);

  return rows[0]?.timezone ?? 'UTC';
}

/** The household a child belongs to (a child with none cannot hold a place: the hold is for a household). */
async function householdOfInTx(db: Db, personId: string): Promise<string | null> {
  const { rows } = await db.query<{ household_id: string }>(
    'SELECT household_id FROM household_members WHERE person_id = $1 ORDER BY household_id LIMIT 1',
    [personId],
  );

  return rows[0]?.household_id ?? null;
}

/**
 * Takes one child's place in one class for a registration. Returns the new registration_classes row id. Refuses (throws) with the
 * reason in plain words when the child may not take the class; nothing is written then.
 */
export async function takeClassPlaceInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  selection: Selection,
): Promise<string> {
  if (!isUuid(selection.camperId) || !isUuid(selection.classId)) {
    throw new RegistrationRefusedError(
      'class_refused',
      'One of the places is not recognised. Choose the classes again.',
    );
  }
  const timeZone = await timeZoneInTx(db, actor.orgId);
  const dateOfBirth = await lockCamper(db, selection.camperId);
  const session = await lockClass(db, selection.classId);
  // Expired holds give their places back first (and the waitlist takes them), so the seat count below is current.
  await releaseExpiredHoldsInSession(db, session.facts.sessionId, actor);
  const camperActive = await activeFactsFor(db, selection.camperId);
  const decision = decideEnrolment(
    {
      session: session.facts,
      seatsTaken: await countTaken(db, session.facts.sessionId),
      camperDateOfBirth: dateOfBirth,
      sessionDay: toLocalDate(new Date(session.facts.startsAt), timeZone),
      camperActive,
    },
    { waitlistIfFull: true, override: null, actorCanOverride: false },
  );
  if (decision.kind === 'refuse') {
    throw new RegistrationRefusedError('class_refused', describeRefusal(decision, timeZone));
  }

  let holdId: string | null = null;
  let enrolmentId: string | null = null;
  if (decision.status === 'waitlisted') {
    enrolmentId = await insertEnrolment(
      db,
      actor,
      { classId: selection.classId, camperId: selection.camperId },
      session,
      decision,
    );
  } else {
    const householdId = await householdOfInTx(db, selection.camperId);
    if (householdId === null) {
      throw new RegistrationRefusedError('camper_no_household');
    }
    try {
      holdId = (
        await placeHoldInTransaction(db, actor, {
          sessionId: selection.classId,
          householdId,
          expiresAt: holdExpiresAt(new Date()),
        })
      ).id;
    } catch (error) {
      if (isClassError(error, 'hold-exists')) {
        throw new RegistrationRefusedError(
          'class_refused',
          'This household already holds a place in that class. Release that hold first.',
        );
      }
      throw error;
    }
  }

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, hold_id, enrolment_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [actor.orgId, registrationId, selection.classId, selection.camperId, holdId, enrolmentId],
  );

  return rows[0].id;
}

/**
 * Confirmation settles each place. A place still held is released as 'completed' and its enrolment is created through the existing
 * enrolment path (so the capacity rule and its audit entries apply). A hold that ran out (or was released) is taken again: the child
 * gets a place if one is free, or the waitlist. A waitlisted or already-enrolled place is left as it is.
 */
export async function settleClassesInTx(db: Db, actor: Actor, registrationId: string): Promise<void> {
  const timeZone = await timeZoneInTx(db, actor.orgId);
  const { rows } = await db.query<{
    id: string;
    class_id: string;
    person_id: string;
    hold_id: string | null;
    enrolment_id: string | null;
    hold_active: boolean | null;
  }>(
    `SELECT rc.id, rc.class_id, rc.person_id, rc.hold_id, rc.enrolment_id,
            (h.released_at IS NULL AND h.expires_at > now()) AS hold_active
       FROM registration_classes rc
       LEFT JOIN seat_holds h ON h.org_id = rc.org_id AND h.id = rc.hold_id
      WHERE rc.registration_id = $1
      ORDER BY rc.created_at, rc.id`,
    [registrationId],
  );

  for (const row of rows) {
    if (row.enrolment_id !== null) {
      continue;
    }
    if (row.hold_id !== null && row.hold_active === true) {
      await db.query(
        `UPDATE seat_holds SET released_at = now(), release_reason = 'completed'
          WHERE org_id = $1 AND id = $2 AND released_at IS NULL`,
        [actor.orgId, row.hold_id],
      );
      await recordAudit(db, {
        actor,
        action: 'hold.release',
        entity: 'seat_hold',
        entityId: row.hold_id,
        data: { sessionId: row.class_id, reason: 'completed' },
      });
    }
    const enrolment = await enrolAtConfirmation(db, actor, row.class_id, row.person_id, timeZone);
    await db.query('UPDATE registration_classes SET enrolment_id = $2 WHERE id = $1', [row.id, enrolment]);
  }
}

/** Creates the enrolment for a confirmed place through the existing path. Its refusals become refusals of the confirmation. */
async function enrolAtConfirmation(
  db: Db,
  actor: Actor,
  classId: string,
  personId: string,
  timeZone: string,
): Promise<string> {
  try {
    const enrolment = await enrolInTransaction(db, actor, { classId, camperId: personId }, facts =>
      decideEnrolment(
        { ...facts, sessionDay: toLocalDate(new Date(facts.session.startsAt), timeZone) },
        { waitlistIfFull: true, override: null, actorCanOverride: false },
      ),
    );

    return enrolment.id;
  } catch (error) {
    if (isEnrolmentRefusal(error)) {
      throw new RegistrationRefusedError('class_refused', describeRefusal(error.refusal, timeZone));
    }
    throw error;
  }
}

/** The camp's classes among `classIds`, with their parent session. Row-level security keeps other camps' classes out. */
export async function classLookupsInTx(db: Db, classIds: readonly string[]): Promise<ClassLookup[]> {
  const valid = classIds.filter(isUuid);
  if (valid.length === 0) {
    return [];
  }
  const { rows } = await db.query<{
    class_id: string;
    session_id: string;
    class_name: string;
    starts_at: Date;
    ends_at: Date;
  }>(
    `SELECT s.id AS class_id, s.class_id AS session_id, s.name AS class_name, s.starts_at, s.ends_at
       FROM sessions s
      WHERE s.id = ANY($1::uuid[])`,
    [valid],
  );

  return rows.map(r => ({
    classId: r.class_id,
    sessionId: r.session_id,
    className: r.class_name ?? '',
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
  }));
}

/** Records a payment for one child's place. Audits the change without the note's text (a note can name people). */
export async function recordPaymentInTx(
  db: Db,
  actor: Actor,
  registrationClassId: string,
  input: { paid: boolean; note: string | null },
): Promise<void> {
  if (!isUuid(registrationClassId)) {
    throw new RegistrationClassNotFoundError();
  }
  const { rows } = await db.query<{ registration_id: string; class_id: string }>(
    `UPDATE registration_classes
        SET payment_status = $2,
            payment_note = $3,
            paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE NULL END,
            paid_by = CASE WHEN $2 = 'paid' THEN $4::uuid ELSE NULL END
      WHERE id = $1
      RETURNING registration_id, class_id`,
    [registrationClassId, input.paid ? 'paid' : 'unpaid', input.note, actor.userId],
  );
  const row = rows[0];
  if (!row) {
    throw new RegistrationClassNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'registration.payment',
    entity: 'registration_class',
    entityId: registrationClassId,
    data: {
      registrationId: row.registration_id,
      sessionId: row.class_id,
      paymentStatus: input.paid ? 'paid' : 'unpaid',
      hasNote: input.note !== null,
    },
  });
}
