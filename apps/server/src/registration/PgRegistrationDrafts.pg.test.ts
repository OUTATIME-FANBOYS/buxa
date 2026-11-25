import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { updateFormRow } from './PgRegistrationWrites';
import { RegistrationFormNoSessionsError, RegistrationSessionNotFoundError } from './errors';
import { createRegistrationFixture, type RegistrationFixture } from './__tests__/registrationFixture';

const url = process.env.DATABASE_URL;

/*
 * Drafts and the publish copy in Postgres (migration 0071). Saving a draft writes the draft columns only; publishing copies the draft
 * into the live row and writes an immutable version with the name and sessions it was published with (no season: the camp no longer enters one). Needs DATABASE_URL.
 */
describe.skipIf(!url)('registration form drafts in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  // Confirmation is not part of these tests, so no badge is ever issued.
  const registration: RegistrationService = createRegistrationService(repo, () => {
    throw new Error('no badge expected in this test');
  });
  const tag = randomBytes(4).toString('hex');

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** A second session of the same camp, for the draft to move to. */
  async function addSession(fx: RegistrationFixture, name: string): Promise<string> {
    return withOrg(pool, fx.userId, fx.orgId, async db => {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, $2, DATE '2027-08-01', DATE '2027-08-02') RETURNING id`,
        [fx.orgId, name],
      );

      return rows[0].id;
    });
  }

  async function formWithPublish(): Promise<{ fx: RegistrationFixture; formId: string; admin: Actor; staff: Actor }> {
    const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
    const admin = fx.actor('admin');
    const staff = fx.actor('staff');
    const form = await registration.createForm(admin, {
      name: 'Summer',
      sessionIds: [fx.sessionId],
      fields: [],
    });
    await registration.publishForm(admin, form.id);

    return { fx, formId: form.id, admin, staff };
  }

  const live = (fx: RegistrationFixture, formId: string) =>
    withOrg(pool, fx.userId, fx.orgId, async db => {
      const form = await db.query<{ name: string; season: string | null; published_version: number | null }>(
        'SELECT name, season, published_version FROM registration_forms WHERE id = $1',
        [formId],
      );
      const sessions = await db.query<{ session_id: string }>(
        'SELECT session_id FROM registration_form_sessions WHERE form_id = $1 ORDER BY session_id',
        [formId],
      );

      return { form: form.rows[0], sessions: sessions.rows.map(r => r.session_id).sort() };
    });

  const draft = (fx: RegistrationFixture, formId: string) =>
    withOrg(pool, fx.userId, fx.orgId, async db => {
      const { rows } = await db.query<{ draft_name: string; draft_season: string | null; draft_session_ids: string[] }>(
        'SELECT draft_name, draft_season, draft_session_ids::text[] AS draft_session_ids FROM registration_forms WHERE id = $1',
        [formId],
      );

      return { ...rows[0], draft_session_ids: [...rows[0].draft_session_ids].sort() };
    });

  it('saving a draft writes the draft columns and leaves the live name, season and sessions unchanged', async () => {
    const { fx, formId, admin } = await formWithPublish();
    const second = await addSession(fx, `Second ${tag}`);

    await registration.updateForm(admin, formId, {
      name: 'Draft name',
      sessionIds: [fx.sessionId, second],
      fields: [{ kind: 'text', key: 'allergies', label: 'Allergies', required: false }],
    });

    const after = await live(fx, formId);
    expect(after.form).toEqual({ name: 'Summer', season: null, published_version: 1 });
    expect(after.sessions).toEqual([fx.sessionId]);
    const drafted = await draft(fx, formId);
    expect(drafted.draft_name).toBe('Draft name');
    expect(drafted.draft_season).toBeNull();
    expect(drafted.draft_session_ids).toEqual([fx.sessionId, second].sort());
  });

  it('publishing copies the draft to the live row and writes a version with its name and sessions', async () => {
    const { fx, formId, admin } = await formWithPublish();
    const second = await addSession(fx, `Second ${tag}`);
    await registration.updateForm(admin, formId, {
      name: 'Draft name',
      sessionIds: [second],
      fields: [],
    });

    const published = await registration.publishForm(admin, formId);

    expect(published.publishedVersion).toBe(2);
    const after = await live(fx, formId);
    expect(after.form).toEqual({ name: 'Draft name', season: null, published_version: 2 });
    expect(after.sessions).toEqual([second]);
    const version = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ name: string; season: string | null; session_ids: string[] }>(
        `SELECT name, season, session_ids::text[] AS session_ids FROM registration_form_versions
          WHERE form_id = $1 AND version = 2`,
        [formId],
      ),
    );
    expect(version.rows).toEqual([{ name: 'Draft name', season: null, session_ids: [second] }]);
  });

  it('the first version keeps the name and sessions it was published with after a later draft', async () => {
    const { fx, formId, admin } = await formWithPublish();
    const second = await addSession(fx, `Second ${tag}`);
    await registration.updateForm(admin, formId, {
      name: 'Later',
      sessionIds: [second],
      fields: [],
    });

    const first = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ name: string; session_ids: string[] }>(
        `SELECT name, session_ids::text[] AS session_ids FROM registration_form_versions WHERE form_id = $1 AND version = 1`,
        [formId],
      ),
    );
    expect(first.rows).toEqual([{ name: 'Summer', session_ids: [fx.sessionId] }]);
  });

  it('publishing a draft with no sessions is refused, and writes no version', async () => {
    const { fx, formId, admin } = await formWithPublish();
    await withOrg(pool, fx.userId, fx.orgId, db =>
      updateFormRow(db, admin, formId, { name: 'Empty', season: null, sessionIds: [], fields: [] }),
    );

    await expect(registration.publishForm(admin, formId)).rejects.toBeInstanceOf(RegistrationFormNoSessionsError);
    const versions = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM registration_form_versions WHERE form_id = $1', [formId]),
    );
    expect(versions.rows[0].n).toBe('1');
  });

  it('publishing refuses a draft session that is no longer in the camp, and changes nothing live', async () => {
    const { fx, formId, admin } = await formWithPublish();
    const gone = '99999999-9999-4999-8999-999999999999';
    await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query('UPDATE registration_forms SET draft_session_ids = ARRAY[$2]::uuid[] WHERE id = $1', [formId, gone]),
    );

    await expect(registration.publishForm(admin, formId)).rejects.toBeInstanceOf(RegistrationSessionNotFoundError);
    const after = await live(fx, formId);
    expect(after.form.published_version).toBe(1);
    expect(after.sessions).toEqual([fx.sessionId]);
  });

  it('a family reads the session set of the published version, not the draft', async () => {
    const { fx, formId, admin, staff } = await formWithPublish();
    const second = await addSession(fx, `Second ${tag}`);
    await registration.updateForm(admin, formId, {
      name: 'Summer',
      sessionIds: [fx.sessionId, second],
      fields: [],
    });

    const family = await registration.publishedVersion(staff, formId);
    expect(family?.sessions.map(s => s.id)).toEqual([fx.sessionId]);
    expect(family?.name).toBe('Summer');
  });
});
