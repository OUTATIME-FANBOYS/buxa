import { decideSelections, type Actor } from '@buxa/domain';
import type { RegistrationFormInput } from '@buxa/contracts';
import type { RegistrationStatus } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import { settleClassesInTx, takeClassPlaceInTx } from './PgRegistrationPlaces';
import { insertDocumentsInTx } from './PgRegistrationFiles';
import {
  RegistrationFormNoSessionsError,
  RegistrationFormNotFoundError,
  RegistrationNotFoundError,
  RegistrationSessionNotFoundError,
  RegistrationRefusedError,
} from './errors';
import type {
  ConfirmationRule,
  NewRegistration,
  RegistrationFactsInTx,
  RegistrationRule,
} from './RegistrationRepository';

/*
 * Writes for registration forms and submissions. Each write audits itself in the same transaction (the caller runs it inside withOrg).
 * Postgres errors are translated here, into the domain errors in ./errors.ts, before they leave this file.
 */

/** The session set is replaced by a function (migration 0023): the request role has no DELETE on it. */
export async function replaceSessions(db: Db, actor: Actor, formId: string, sessionIds: string[]): Promise<void> {
  try {
    await db.query('SELECT buxa_replace_form_sessions_v2($1, $2, $3::uuid[])', [actor.orgId, formId, sessionIds]);
  } catch (error) {
    throw translateSessionError(error);
  }
}

function translateSessionError(error: unknown): unknown {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const message = error instanceof Error ? error.message : '';
  if (code === 'P0002' && message === 'Session not found') {
    return new RegistrationSessionNotFoundError();
  }
  if (code === 'P0002') {
    return new RegistrationFormNotFoundError();
  }

  return error;
}

export async function insertForm(db: Db, actor: Actor, input: RegistrationFormInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO registration_forms (org_id, name, season, draft_fields)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [actor.orgId, input.name, input.season, JSON.stringify(input.fields)],
  );
  const id = rows[0].id;
  await replaceSessions(db, actor, id, input.sessionIds);
  await recordAudit(db, {
    actor,
    action: 'registration_form.create',
    entity: 'registration_form',
    entityId: id,
    data: { name: input.name },
  });

  return id;
}

export async function updateFormRow(db: Db, actor: Actor, formId: string, input: RegistrationFormInput): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE registration_forms
        SET name = $2, season = $3, draft_fields = $4::jsonb, updated_at = now()
      WHERE id = $1`,
    [formId, input.name, input.season, JSON.stringify(input.fields)],
  );
  if (rowCount === 0) {
    throw new RegistrationFormNotFoundError();
  }
  await replaceSessions(db, actor, formId, input.sessionIds);
  await recordAudit(db, {
    actor,
    action: 'registration_form.update',
    entity: 'registration_form',
    entityId: formId,
    data: { name: input.name },
  });
}

/** Writes the next immutable version from the draft and points the form at it. */
export async function publishFormRow(db: Db, actor: Actor, formId: string): Promise<number> {
  const { rows } = await db.query<{ fields: unknown; version: number }>(
    `SELECT f.draft_fields AS fields, COALESCE((SELECT max(v.version) FROM registration_form_versions v
                                                WHERE v.form_id = f.id), 0) + 1 AS version
       FROM registration_forms f WHERE f.id = $1 FOR UPDATE`,
    [formId],
  );
  const draft = rows[0];
  if (!draft) {
    throw new RegistrationFormNotFoundError();
  }
  const covered = await db.query<{ n: string }>(
    'SELECT count(*) AS n FROM registration_form_sessions WHERE form_id = $1',
    [formId],
  );
  if (Number(covered.rows[0]?.n ?? 0) === 0) {
    throw new RegistrationFormNoSessionsError();
  }
  await db.query(
    `INSERT INTO registration_form_versions (org_id, form_id, version, fields, published_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [actor.orgId, formId, draft.version, JSON.stringify(draft.fields), actor.userId],
  );
  await db.query('UPDATE registration_forms SET published_version = $2, updated_at = now() WHERE id = $1', [
    formId,
    draft.version,
  ]);
  await recordAudit(db, {
    actor,
    action: 'registration_form.publish',
    entity: 'registration_form',
    entityId: formId,
    data: { version: draft.version },
  });

  return draft.version;
}

/**
 * Locks the form, gathers the facts the rule needs, and writes the registration only when the rule allows it. The lock serialises
 * submissions to one form, so the facts the rule sees are the ones the write is based on.
 */
export async function insertRegistrationInTx(
  db: Db,
  actor: Actor,
  registration: NewRegistration,
  rule: RegistrationRule,
): Promise<string> {
  const { rows } = await db.query<{ published_version: number | null }>(
    'SELECT published_version FROM registration_forms WHERE id = $1 FOR UPDATE',
    [registration.formId],
  );
  if (rows.length === 0) {
    throw new RegistrationFormNotFoundError();
  }
  // A session takes registrations only while it is live (migration 0053). A draft or archived session of the form is closed: a
  // submission that names it is refused. A session that is archived by archived_at alone (an older release) is closed too.
  const sessions = await db.query<{ session_id: string; closed: boolean }>(
    `SELECT fs.session_id, (c.status <> 'live' OR c.archived_at IS NOT NULL) AS closed
       FROM registration_form_sessions fs
       JOIN classes c ON c.id = fs.session_id AND c.org_id = fs.org_id
      WHERE fs.form_id = $1`,
    [registration.formId],
  );
  const facts: RegistrationFactsInTx = {
    publishedVersion: rows[0].published_version,
    formSessionIds: sessions.rows.map(r => r.session_id),
    closedSessionIds: sessions.rows.filter(r => r.closed).map(r => r.session_id),
  };
  const decision = rule(facts);
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }

  // The clash rule between one child's classes is checked again here, under the same transaction as the places it guards.
  const selections = decideSelections(registration.selections);
  if (!selections.allow) {
    throw new RegistrationRefusedError(selections.reason);
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO registrations (org_id, form_id, form_version, answers, submitted_by)
     VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
    [actor.orgId, registration.formId, registration.version, JSON.stringify(registration.answers), actor.userId],
  );
  const id = inserted.rows[0].id;
  // registration_sessions is no longer written: a registration's sessions are derived from its places (registration_classes).
  for (const selection of registration.selections) {
    await takeClassPlaceInTx(db, actor, id, selection);
  }
  await insertDocumentsInTx(db, actor, id, registration.documents);
  await recordAudit(db, {
    actor,
    action: 'registration.submit',
    entity: 'registration',
    entityId: id,
    data: {
      formId: registration.formId,
      sessions: registration.sessionIds.length,
      places: registration.selections.length,
      documents: registration.documents.length,
    },
  });

  return id;
}

/**
 * Locks the registration, checks its status against the rule and, on allow, confirms it. The audit row is written in the same
 * transaction, so a confirmation without its entry cannot exist.
 */
export async function confirmRegistrationInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  rule: ConfirmationRule,
): Promise<void> {
  const { rows } = await db.query<{ status: RegistrationStatus; form_id: string }>(
    'SELECT status, form_id FROM registrations WHERE id = $1 FOR UPDATE',
    [registrationId],
  );
  const registration = rows[0];
  if (!registration) {
    throw new RegistrationNotFoundError();
  }
  const decision = rule(registration.status);
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }
  await db.query(
    `UPDATE registrations SET status = 'confirmed', confirmed_at = now(), confirmed_by = $2 WHERE id = $1`,
    [registrationId, actor.userId],
  );
  await settleClassesInTx(db, actor, registrationId);
  await recordAudit(db, {
    actor,
    action: 'registration.confirm',
    entity: 'registration',
    entityId: registrationId,
    data: { formId: registration.form_id },
  });
}

/**
 * The people a registration names as campers: the children chosen for its classes, and any active camper whose name and birth date
 * match the camper answers (registrations recorded before classes were chosen have no places). Runs inside the confirmation
 * transaction, so the badges it leads to commit with the confirmation.
 */
export async function camperIdsInTx(db: Db, registrationId: string): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT rc.person_id AS id FROM registration_classes rc WHERE rc.registration_id = $1
     UNION
     SELECT DISTINCT p.id
       FROM registrations r
       JOIN people p ON p.org_id = r.org_id
        AND lower(btrim(p.given_name)) = lower(btrim(r.answers #>> '{standard,camperFirstName}'))
        AND lower(btrim(p.family_name)) = lower(btrim(r.answers #>> '{standard,camperLastName}'))
        AND to_char(p.date_of_birth, 'YYYY-MM-DD') = r.answers #>> '{standard,camperBirthDate}'
        AND p.archived_at IS NULL
       JOIN person_roles pr ON pr.org_id = p.org_id AND pr.person_id = p.id AND pr.role = 'camper'
      WHERE r.id = $1`,
    [registrationId],
  );

  return rows.map(r => r.id);
}
