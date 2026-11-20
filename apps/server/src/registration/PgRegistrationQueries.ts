import { z } from 'zod';
import { CustomFieldSchema, type CustomField, type RegistrationForm, type RegistrationRow } from '@buxa/contracts';
import type { Db } from '../people/pgRows';
import { RegistrationFormNotFoundError } from './errors';

/*
 * Reads for registration forms and submissions. Rows are parsed with zod where they leave the database, so the rest of the server
 * sees typed values and no casts. Every query runs inside withOrg (row-level security), so another camp's rows never appear.
 */

/** The form row with its session set and its submission count, as the list and the detail screens need it. */
const FORM_SELECT = `
  SELECT f.id, f.name, f.season, f.draft_fields AS fields, f.published_version, f.updated_at,
         COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name, c.id)
                     FROM registration_form_sessions s
                     JOIN classes c ON c.id = s.session_id AND c.org_id = s.org_id
                    WHERE s.form_id = f.id), '[]') AS sessions,
         (SELECT count(*)::int FROM registrations r WHERE r.form_id = f.id) AS submission_count
    FROM registration_forms f`;

interface FormRow {
  id: string;
  name: string;
  season: string | null;
  fields: unknown;
  published_version: number | null;
  updated_at: Date;
  sessions: { id: string; name: string }[];
  submission_count: number;
}

const StoredAnswersSchema = z.object({
  standard: z.record(z.string(), z.string()),
  custom: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

const FieldsSchema = z.array(CustomFieldSchema);

function toForm(row: FormRow): RegistrationForm {
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    sessions: row.sessions,
    fields: FieldsSchema.parse(row.fields),
    publishedVersion: row.published_version,
    submissionCount: row.submission_count,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listFormRows(db: Db): Promise<RegistrationForm[]> {
  const { rows } = await db.query<FormRow>(`${FORM_SELECT} ORDER BY lower(f.name), f.id`);

  return rows.map(toForm);
}

export async function getFormRow(db: Db, formId: string): Promise<RegistrationForm | null> {
  const { rows } = await db.query<FormRow>(`${FORM_SELECT} WHERE f.id = $1`, [formId]);

  return rows[0] ? toForm(rows[0]) : null;
}

/** Throws RegistrationFormNotFoundError when the form is not in this camp. */
export async function requireFormRow(db: Db, formId: string): Promise<RegistrationForm> {
  const form = await getFormRow(db, formId);
  if (!form) {
    throw new RegistrationFormNotFoundError();
  }

  return form;
}

export async function publishedVersionRow(
  db: Db,
  formId: string,
): Promise<{ version: number; fields: CustomField[] } | null> {
  const { rows } = await db.query<{ version: number; fields: unknown }>(
    `SELECT v.version, v.fields
       FROM registration_forms f
       JOIN registration_form_versions v ON v.form_id = f.id AND v.version = f.published_version
      WHERE f.id = $1`,
    [formId],
  );
  const row = rows[0];

  return row ? { version: row.version, fields: FieldsSchema.parse(row.fields) } : null;
}

/** Every submission to a form, with the sessions it asks for. The screen groups them by session. */
export async function listSubmissionRows(db: Db, formId: string): Promise<RegistrationRow[]> {
  await requireFormRow(db, formId);
  const { rows } = await db.query<{
    id: string;
    form_version: number;
    created_at: Date;
    answers: unknown;
    status: 'pending' | 'confirmed';
    confirmed_at: Date | null;
  }>(
    `SELECT r.id, r.form_version, r.created_at, r.answers, r.status, r.confirmed_at
       FROM registrations r WHERE r.form_id = $1 ORDER BY r.created_at, r.id`,
    [formId],
  );
  if (rows.length === 0) {
    return [];
  }
  const sessions = await db.query<{ registration_id: string; session_id: string; status: 'submitted'; name: string }>(
    `SELECT rs.registration_id, rs.session_id, rs.status, c.name
       FROM registration_sessions rs
       JOIN classes c ON c.id = rs.session_id AND c.org_id = rs.org_id
      WHERE rs.registration_id = ANY($1::uuid[])
      ORDER BY c.name, rs.session_id`,
    [rows.map(r => r.id)],
  );

  return rows.map(r => {
    const answers = StoredAnswersSchema.parse(r.answers);

    return {
      id: r.id,
      formVersion: r.form_version,
      submittedAt: r.created_at.toISOString(),
      status: r.status,
      confirmedAt: r.confirmed_at ? r.confirmed_at.toISOString() : null,
      standard: answers.standard,
      custom: answers.custom,
      sessions: sessions.rows
        .filter(s => s.registration_id === r.id)
        .map(s => ({ sessionId: s.session_id, sessionName: s.name, status: s.status })),
    };
  });
}
