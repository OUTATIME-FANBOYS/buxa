import type { Actor } from '@buxa/domain';
import type { RegistrationFormInput } from '@buxa/contracts';
import type { RegistrationStatus } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import {
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
  const sessions = await db.query<{ session_id: string }>(
    'SELECT session_id FROM registration_form_sessions WHERE form_id = $1',
    [registration.formId],
  );
  const facts: RegistrationFactsInTx = {
    publishedVersion: rows[0].published_version,
    formSessionIds: sessions.rows.map(r => r.session_id),
  };
  const decision = rule(facts);
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO registrations (org_id, form_id, form_version, answers, submitted_by)
     VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
    [actor.orgId, registration.formId, registration.version, JSON.stringify(registration.answers), actor.userId],
  );
  const id = inserted.rows[0].id;
  await db.query(
    `INSERT INTO registration_sessions (org_id, registration_id, session_id)
     SELECT $1, $2, unnest($3::uuid[])`,
    [actor.orgId, id, registration.sessionIds],
  );
  await recordAudit(db, {
    actor,
    action: 'registration.submit',
    entity: 'registration',
    entityId: id,
    data: { formId: registration.formId, sessions: registration.sessionIds.length },
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
  await recordAudit(db, {
    actor,
    action: 'registration.confirm',
    entity: 'registration',
    entityId: registrationId,
    data: { formId: registration.form_id },
  });
}
