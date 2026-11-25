import { decideSelections, type Actor } from '@buxa/domain';
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
  FormDeletionRule,
  NewRegistration,
  RegistrationFactsInTx,
  RegistrationFormWrite,
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

/**
 * Every session id must be a session of this camp. Drafts name sessions without a foreign key (a uuid array), so the check is here,
 * inside the transaction; the publish copy checks again when it writes the live rows.
 */
async function requireSessionsInCamp(db: Db, sessionIds: readonly string[]): Promise<void> {
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM classes WHERE id = ANY($1::uuid[])', [
    [...sessionIds],
  ]);
  if (rows[0].n !== new Set(sessionIds).size) {
    throw new RegistrationSessionNotFoundError();
  }
}

/**
 * Creates a form. Its draft holds the values; nothing is published yet, so the live name and season are the same as the draft, and no live session rows are written. Families cannot see a form until it is published.
 */
export async function insertForm(db: Db, actor: Actor, input: RegistrationFormWrite): Promise<string> {
  await requireSessionsInCamp(db, input.sessionIds);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO registration_forms (org_id, name, season, draft_name, draft_season, draft_session_ids, draft_fields)
     VALUES ($1, $2, $3, $2, $3, $4::uuid[], $5::jsonb) RETURNING id`,
    [actor.orgId, input.name, input.season, input.sessionIds, JSON.stringify(input.fields)],
  );
  const id = rows[0].id;
  await recordAudit(db, {
    actor,
    action: 'registration_form.create',
    entity: 'registration_form',
    entityId: id,
    data: { name: input.name },
  });

  return id;
}

/**
 * Saves the draft: name, season, sessions and questions. The live name, season and sessions, and the published version, are not
 * touched; only a publish changes them (families register on the published version). Audited with the name only.
 */
export async function updateFormRow(db: Db, actor: Actor, formId: string, input: RegistrationFormWrite): Promise<void> {
  await requireSessionsInCamp(db, input.sessionIds);
  const { rowCount } = await db.query(
    `UPDATE registration_forms
        SET draft_name = $2, draft_season = $3, draft_session_ids = $4::uuid[], draft_fields = $5::jsonb, updated_at = now()
      WHERE id = $1`,
    [formId, input.name, input.season, input.sessionIds, JSON.stringify(input.fields)],
  );
  if (rowCount === 0) {
    throw new RegistrationFormNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'registration_form.update',
    entity: 'registration_form',
    entityId: formId,
    data: { name: input.name },
  });
}

/**
 * Publishes the draft in one transaction: the draft's name, season and sessions become the live row (the session set is replaced,
 * and every session must still be in this camp), and the draft's questions, name, season and session ids are written as the next
 * immutable version. A form whose draft has no sessions is refused, and nothing is written.
 */
export async function publishFormRow(db: Db, actor: Actor, formId: string): Promise<number> {
  const { rows } = await db.query<{
    name: string;
    season: string | null;
    session_ids: string[];
    fields: unknown;
    version: number;
  }>(
    `SELECT f.draft_name AS name, f.draft_season AS season, f.draft_session_ids::text[] AS session_ids, f.draft_fields AS fields,
            COALESCE((SELECT max(v.version) FROM registration_form_versions v WHERE v.form_id = f.id), 0) + 1 AS version
       FROM registration_forms f WHERE f.id = $1 FOR UPDATE`,
    [formId],
  );
  const draft = rows[0];
  if (!draft) {
    throw new RegistrationFormNotFoundError();
  }
  if (draft.session_ids.length === 0) {
    throw new RegistrationFormNoSessionsError();
  }
  // Replaces the live session set. The function refuses a session that is not in this camp (P0002), so nothing below runs for it.
  await replaceSessions(db, actor, formId, draft.session_ids);
  await db.query(
    `INSERT INTO registration_form_versions (org_id, form_id, version, fields, published_by, name, season, session_ids)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::uuid[])`,
    [
      actor.orgId,
      formId,
      draft.version,
      JSON.stringify(draft.fields),
      actor.userId,
      draft.name,
      draft.season,
      draft.session_ids,
    ],
  );
  await db.query(
    `UPDATE registration_forms
        SET name = draft_name, season = draft_season, published_version = $2, updated_at = now()
      WHERE id = $1`,
    [formId, draft.version],
  );
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
 * Deletes a form that no registration names. The count and the row lock are taken in this transaction, so a registration cannot be
 * added between the check and the delete. The database function (migration 0070) refuses the same case as a backstop; its refusal
 * is translated here, so the caller sees the same error either way.
 */
export async function deleteFormInTx(db: Db, actor: Actor, formId: string, rule: FormDeletionRule): Promise<void> {
  const { rows } = await db.query<{ name: string; registration_count: number }>(
    `SELECT f.name, (SELECT count(*)::int FROM registrations r WHERE r.form_id = f.id) AS registration_count
       FROM registration_forms f WHERE f.id = $1 FOR UPDATE`,
    [formId],
  );
  const form = rows[0];
  if (!form) {
    throw new RegistrationFormNotFoundError();
  }
  const decision = rule({ registrationCount: form.registration_count });
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }
  try {
    await db.query('SELECT buxa_delete_registration_form_v1($1, $2)', [actor.orgId, formId]);
  } catch (error) {
    throw translateFormDeleteError(error);
  }
  await recordAudit(db, {
    actor,
    action: 'registration_form.delete',
    entity: 'registration_form',
    entityId: formId,
    data: { name: form.name },
  });
}

function translateFormDeleteError(error: unknown): unknown {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const constraint =
    typeof error === 'object' && error !== null && 'constraint' in error ? error.constraint : undefined;
  if (constraint === 'registration_form_has_registrations') {
    return new RegistrationRefusedError('form_has_registrations');
  }
  if (code === 'P0002') {
    return new RegistrationFormNotFoundError();
  }

  return error;
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
  // The sessions a family may ask for are the published version's (migration 0071), never the draft's.
  const { rows } = await db.query<{ published_version: number | null; session_ids: string[] }>(
    `SELECT f.published_version, buxa_form_published_session_ids(f.org_id, f.id)::text[] AS session_ids
       FROM registration_forms f WHERE f.id = $1 FOR UPDATE OF f`,
    [registration.formId],
  );
  if (rows.length === 0) {
    throw new RegistrationFormNotFoundError();
  }
  // A session takes registrations only while it is live (migration 0053). A draft or archived session of the form is closed: a
  // submission that names it is refused. A session that is archived by archived_at alone (an older release) is closed too.
  const sessions = await db.query<{ id: string; closed: boolean }>(
    `SELECT c.id, (c.status <> 'live' OR c.archived_at IS NOT NULL) AS closed
       FROM classes c
      WHERE c.org_id = $1 AND c.id = ANY($2::uuid[])`,
    [actor.orgId, rows[0].session_ids],
  );
  const facts: RegistrationFactsInTx = {
    publishedVersion: rows[0].published_version,
    formSessionIds: rows[0].session_ids,
    closedSessionIds: sessions.rows.filter(r => r.closed).map(r => r.id),
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
