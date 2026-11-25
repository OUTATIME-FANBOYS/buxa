import {
  classDatesRefusal,
  decideEnrolment,
  describeRefusal,
  holdExpiresAt,
  isUuid,
  shownPrice,
  toLocalDate,
  type Actor,
  type ClassPrice,
} from '@buxa/domain';
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
 * is free at submission is held for the child, recorded with the household they belong to (seat_holds, 15 minutes). Siblings each hold their own place in the same class. A full class puts the child on its waitlist: a waitlist
 * enrolment, in the order they joined. Confirmation releases each hold as 'completed' and creates the enrolment.
 * Everything here runs inside the caller's transaction (withOrg), so a refused place leaves nothing behind.
 */

type Selection = NewRegistration['selections'][number];

/** The camp's time zone, which decides the day a session's age is taken on. */
async function timeZoneInTx(db: Db, orgId: string): Promise<string> {
  const { rows } = await db.query<{ timezone: string }>('SELECT timezone FROM orgs WHERE id = $1', [orgId]);

  return rows[0]?.timezone ?? 'UTC';
}

/**
 * The household a child belongs to, recorded on the hold (a child with none cannot hold a place). The first by id when the child is in
 * several. The hold is for the child, so the choice does not decide who may hold the class.
 */
async function householdOfInTx(db: Db, personId: string): Promise<string | null> {
  const { rows } = await db.query<{ household_id: string }>(
    'SELECT household_id FROM household_members WHERE person_id = $1 ORDER BY household_id LIMIT 1',
    [personId],
  );

  return rows[0]?.household_id ?? null;
}

/** The price a family sees today for a class, to be kept on the registration place: the amount in force, its currency, and whether it is the early-bird amount. Null when the class has no price. */
async function priceSnapshotInTx(
  db: Db,
  classId: string,
  today: string,
): Promise<{ minor: number; currency: string; earlyBird: boolean } | null> {
  const { rows } = await db.query<{
    price_minor: number | null;
    price_currency: string | null;
    early_bird_minor: number | null;
    early_bird_until: string | null;
  }>(
    `SELECT price_minor, price_currency, early_bird_minor, to_char(early_bird_until, 'YYYY-MM-DD') AS early_bird_until
       FROM sessions WHERE id = $1`,
    [classId],
  );
  const row = rows[0];
  if (!row || row.price_minor === null || row.price_currency === null) {
    return null;
  }
  const price: ClassPrice = {
    currency: row.price_currency,
    regularMinor: row.price_minor,
    earlyBirdMinor: row.early_bird_minor,
    earlyBirdUntil: row.early_bird_until,
  };
  const shown = shownPrice(price, today);

  return shown ? { minor: shown.amountMinor, currency: shown.currency, earlyBird: shown.earlyBird } : null;
}

/**
 * The series checks a place needs beyond the day's own rule (a place is taken per series, not per day). Refused, with nothing written,
 * when a day of the series is flagged (its dates are outside the session's), when the child already has a place in the series, or
 * when the child has an active place in another series on one of its days. The series is read from the anchor day, not trusted from
 * the form.
 */
async function refuseSeriesPlaceInTx(
  db: Db,
  camperId: string,
  anchorId: string,
  className: string,
  timeZone: string,
): Promise<void> {
  const { rows: anchor } = await db.query<{ series_id: string }>('SELECT series_id FROM sessions WHERE id = $1', [
    anchorId,
  ]);
  const seriesId = anchor[0]?.series_id;
  if (seriesId === undefined) {
    throw new RegistrationClassNotFoundError();
  }
  const { rows: flags } = await db.query<{ flagged: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM sessions WHERE series_id = $1 AND status = 'active' AND dates_outside_session) AS flagged`,
    [seriesId],
  );
  const flagged = classDatesRefusal(flags[0]?.flagged ?? false);
  if (flagged !== null) {
    throw new RegistrationRefusedError('class_refused', flagged);
  }
  const { rows: placed } = await db.query<{ enrolled: boolean; held: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM enrolments WHERE series_id = $1 AND person_id = $2 AND status IN ('enrolled', 'waitlisted')) AS enrolled,
            EXISTS (SELECT 1 FROM seat_holds WHERE series_id = $1 AND person_id = $2 AND released_at IS NULL AND expires_at > now()) AS held`,
    [seriesId, camperId],
  );
  if (placed[0]?.held) {
    throw new RegistrationRefusedError(
      'class_refused',
      'This child already holds a place in that class. Release that hold first.',
    );
  }
  if (placed[0]?.enrolled) {
    const { rows: names } = await db.query<{ name: string }>(
      `SELECT given_name || ' ' || family_name AS name FROM people WHERE id = $1`,
      [camperId],
    );
    throw new RegistrationRefusedError(
      'class_refused',
      `${names[0]?.name || 'This child'} is already enrolled in ${className}`,
    );
  }
  const { rows: clashes } = await db.query<{ id: string; class_name: string; starts_at: Date; ends_at: Date }>(
    `WITH other AS (
       SELECT e.series_id FROM enrolments e
        WHERE e.person_id = $2 AND e.series_id <> $1 AND e.status IN ('enrolled', 'waitlisted')
       UNION
       SELECT h.series_id FROM seat_holds h
        WHERE h.person_id = $2 AND h.series_id <> $1 AND h.released_at IS NULL AND h.expires_at > now()
     )
     SELECT o.id, o.name AS class_name, o.starts_at, o.ends_at
       FROM other
       JOIN sessions o ON o.series_id = other.series_id AND o.status = 'active'
       JOIN sessions m ON m.series_id = $1 AND m.status = 'active'
      WHERE tstzrange(m.starts_at, m.ends_at) && tstzrange(o.starts_at, o.ends_at)
      ORDER BY o.starts_at, o.id
      LIMIT 1`,
    [seriesId, camperId],
  );
  const clash = clashes[0];
  if (clash) {
    const decision = {
      kind: 'refuse' as const,
      reason: 'overlap' as const,
      clash: {
        sessionId: clash.id,
        className: clash.class_name,
        startsAt: clash.starts_at.toISOString(),
        endsAt: clash.ends_at.toISOString(),
      },
    };
    throw new RegistrationRefusedError('class_refused', describeRefusal(decision, timeZone));
  }
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
  const datesRefusal = classDatesRefusal(session.datesOutsideSession);
  if (datesRefusal !== null) {
    throw new RegistrationRefusedError('class_refused', datesRefusal);
  }
  await refuseSeriesPlaceInTx(db, selection.camperId, selection.classId, session.facts.className, timeZone);
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
          personId: selection.camperId,
          expiresAt: holdExpiresAt(new Date()),
        })
      ).id;
    } catch (error) {
      if (isClassError(error, 'hold-exists')) {
        throw new RegistrationRefusedError(
          'class_refused',
          'This child already holds a place in that class. Release that hold first.',
        );
      }
      throw error;
    }
  }

  const price = await priceSnapshotInTx(db, selection.classId, toLocalDate(new Date(), timeZone));
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO registration_classes
       (org_id, registration_id, class_id, person_id, hold_id, enrolment_id, price_minor, price_currency, early_bird_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      actor.orgId,
      registrationId,
      selection.classId,
      selection.camperId,
      holdId,
      enrolmentId,
      price?.minor ?? null,
      price?.currency ?? null,
      price === null ? null : price.earlyBird,
    ],
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

/**
 * The camp's classes among `classIds`, with their parent session and their series. The series' active days come with each class, so a
 * child's series can be checked for overlap on every day. Row-level security keeps other camps' classes out.
 */
export async function classLookupsInTx(db: Db, classIds: readonly string[]): Promise<ClassLookup[]> {
  const valid = classIds.filter(isUuid);
  if (valid.length === 0) {
    return [];
  }
  const { rows } = await db.query<{
    class_id: string;
    session_id: string;
    series_id: string;
    class_name: string;
    starts_at: Date;
    ends_at: Date;
  }>(
    `SELECT s.id AS class_id, s.class_id AS session_id, s.series_id, s.name AS class_name, s.starts_at, s.ends_at
       FROM sessions s
      WHERE s.id = ANY($1::uuid[])`,
    [valid],
  );
  const days = await activeDaysInTx(
    db,
    rows.map(r => r.series_id),
  );

  return rows.map(r => ({
    classId: r.class_id,
    sessionId: r.session_id,
    className: r.class_name ?? '',
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    seriesId: r.series_id,
    occurrences: days.get(r.series_id) ?? [],
  }));
}

/** The active days of each series among `seriesIds`, in start order. A cancelled day takes no place, so it is not checked for overlap. */
async function activeDaysInTx(
  db: Db,
  seriesIds: readonly string[],
): Promise<Map<string, { startsAt: string; endsAt: string }[]>> {
  const days = new Map<string, { startsAt: string; endsAt: string }[]>();
  const unique = [...new Set(seriesIds)];
  if (unique.length === 0) {
    return days;
  }
  const { rows } = await db.query<{ series_id: string; starts_at: Date; ends_at: Date }>(
    `SELECT series_id, starts_at, ends_at FROM sessions
      WHERE series_id = ANY($1::uuid[]) AND status = 'active'
      ORDER BY starts_at, id`,
    [unique],
  );
  for (const row of rows) {
    const list = days.get(row.series_id) ?? [];
    list.push({ startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString() });
    days.set(row.series_id, list);
  }

  return days;
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
