import { z } from 'zod';
import {
  CustomFieldSchema,
  type CustomField,
  type RegistrationClass,
  type RegistrationForm,
  type RegistrationRow,
} from '@buxa/contracts';
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
    status: 'pending' | 'confirmed' | 'withdrawn';
    confirmed_at: Date | null;
    withdrawn_at: Date | null;
    archived_at: Date | null;
  }>(
    `SELECT r.id, r.form_version, r.created_at, r.answers, r.status, r.confirmed_at, r.withdrawn_at, r.archived_at
       FROM registrations r WHERE r.form_id = $1 ORDER BY r.created_at, r.id`,
    [formId],
  );
  if (rows.length === 0) {
    return [];
  }
  // A registration's sessions are derived from its places: registration_classes to sessions (the classes) to classes (the sessions).
  // registration_sessions is no longer read.
  const sessions = await db.query<{ registration_id: string; session_id: string; name: string }>(
    `SELECT DISTINCT rc.registration_id, p.id AS session_id, p.name
       FROM registration_classes rc
       JOIN sessions c ON c.id = rc.class_id AND c.org_id = rc.org_id
       JOIN classes p ON p.id = c.class_id AND p.org_id = c.org_id
      WHERE rc.registration_id = ANY($1::uuid[])
      ORDER BY p.name, p.id`,
    [rows.map(r => r.id)],
  );

  const places = await listClassRows(
    db,
    rows.map(r => r.id),
  );

  return rows.map(r => {
    const answers = StoredAnswersSchema.parse(r.answers);

    return {
      id: r.id,
      formVersion: r.form_version,
      submittedAt: r.created_at.toISOString(),
      status: r.status,
      confirmedAt: r.confirmed_at ? r.confirmed_at.toISOString() : null,
      withdrawnAt: r.withdrawn_at ? r.withdrawn_at.toISOString() : null,
      archivedAt: r.archived_at ? r.archived_at.toISOString() : null,
      standard: answers.standard,
      custom: answers.custom,
      sessions: sessions.rows
        .filter(s => s.registration_id === r.id)
        .map(s => ({ sessionId: s.session_id, sessionName: s.name, status: 'submitted' as const })),
      classes: places.filter(p => p.registrationId === r.id).map(p => p.row),
    };
  });
}

interface PlaceRow {
  id: string;
  registration_id: string;
  class_id: string;
  class_name: string | null;
  session_id: string;
  session_name: string;
  person_id: string;
  camper_name: string;
  hold_expires_at: Date | null;
  hold_released_at: Date | null;
  enrolment_status: 'enrolled' | 'waitlisted' | 'cancelled' | null;
  payment_status: 'unpaid' | 'paid';
  payment_note: string | null;
  hold_id: string | null;
  price_minor: number | null;
  price_currency: string | null;
  early_bird_applied: boolean | null;
}

/**
 * The status of a place, read from the hold or the enrolment behind it. An enrolment wins: once there is one, the place is what
 * the enrolment says. Otherwise the hold says: held while it runs, expired once released (expired or cancelled before confirmation).
 */
export function placeStatus(
  row: Pick<PlaceRow, 'enrolment_status' | 'hold_id' | 'hold_released_at' | 'hold_expires_at'>,
  now: Date,
): RegistrationClass['status'] {
  if (row.enrolment_status !== null) {
    return row.enrolment_status;
  }
  if (row.hold_id === null) {
    return 'expired';
  }
  if (row.hold_released_at !== null) {
    return 'expired';
  }

  return row.hold_expires_at !== null && row.hold_expires_at.getTime() > now.getTime() ? 'held' : 'expired';
}

/** Every child-and-class place of the given registrations, with its status and payment. Staff screens only. */
async function listClassRows(
  db: Db,
  registrationIds: string[],
): Promise<{ registrationId: string; row: RegistrationClass }[]> {
  if (registrationIds.length === 0) {
    return [];
  }
  const { rows } = await db.query<PlaceRow>(
    `SELECT rc.id, rc.registration_id, rc.class_id, c.name AS class_name, c.class_id AS session_id, s.name AS session_name,
            rc.person_id, (p.given_name || ' ' || p.family_name) AS camper_name,
            rc.hold_id, h.expires_at AS hold_expires_at, h.released_at AS hold_released_at,
            e.status AS enrolment_status, rc.payment_status, rc.payment_note,
            rc.price_minor, rc.price_currency, rc.early_bird_applied
       FROM registration_classes rc
       JOIN sessions c ON c.id = rc.class_id AND c.org_id = rc.org_id
       JOIN classes s ON s.id = c.class_id AND s.org_id = c.org_id
       JOIN people p ON p.id = rc.person_id AND p.org_id = rc.org_id
       LEFT JOIN seat_holds h ON h.id = rc.hold_id AND h.org_id = rc.org_id
       LEFT JOIN enrolments e ON e.id = rc.enrolment_id AND e.org_id = rc.org_id
      WHERE rc.registration_id = ANY($1::uuid[])
      ORDER BY c.name, rc.id`,
    [registrationIds],
  );
  const now = new Date();

  return rows.map(r => ({
    registrationId: r.registration_id,
    row: {
      id: r.id,
      classId: r.class_id,
      className: r.class_name ?? '',
      sessionId: r.session_id,
      sessionName: r.session_name,
      camperId: r.person_id,
      camperName: r.camper_name,
      status: placeStatus(r, now),
      paymentStatus: r.payment_status,
      paymentNote: r.payment_note,
      price:
        r.price_minor === null || r.price_currency === null
          ? null
          : { amountMinor: r.price_minor, currency: r.price_currency, earlyBird: r.early_bird_applied === true },
    },
  }));
}
