import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService } from './RegistrationService';
import { RegistrationRefusedError } from './errors';

const url = process.env.DATABASE_URL;

// Registration forms and submissions in Postgres: a camp sees only its own forms, sessions and submissions (row-level security),
// and a submission is written only when the rule allows it. Needs DATABASE_URL (see docs/CONTRIBUTING.md).
describe.skipIf(!url)('registration in Postgres: camps are isolated', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  const ids: { userA: string; userB: string; campA: string; campB: string; sessionA: string; sessionB: string } = {
    userA: '',
    userB: '',
    campA: '',
    campB: '',
    sessionA: '',
    sessionB: '',
  };
  let actorA: Actor;
  let actorB: Actor;
  const repo = new PgRegistrationRepository(pool);
  const service = createRegistrationService(repo);

  const formInput = (sessionIds: string[]) => ({
    name: `Form ${tag}`,
    season: 'Summer',
    sessionIds,
    fields: [{ kind: 'yes_no' as const, key: 'photos', label: 'Photo consent', required: true }],
  });

  const standard = {
    camperFirstName: 'Ada',
    camperLastName: 'Lovelace',
    camperBirthDate: '2014-03-09',
    guardianName: 'Byron Lovelace',
    guardianPhone: '555-0100',
    emergencyContactName: 'Mary Somerville',
    emergencyContactPhone: '555-0111',
  };

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'A'), ($2, 'B') RETURNING id`,
      [`a-${tag}@reg.test`, `b-${tag}@reg.test`],
    );
    [ids.userA, ids.userB] = users.rows.map(r => r.id);
    const camps = await pool.query<{ id: string }>(
      `INSERT INTO orgs (name, slug) VALUES ($1, $2), ($3, $4) RETURNING id`,
      [`Reg A ${tag}`, `reg-a-${tag}`, `Reg B ${tag}`, `reg-b-${tag}`],
    );
    [ids.campA, ids.campB] = camps.rows.map(r => r.id);
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin'), ($3, $4, 'admin')`, [
      ids.campA,
      ids.userA,
      ids.campB,
      ids.userB,
    ]);
    const sessions = await pool.query<{ id: string }>(
      `INSERT INTO classes (org_id, name) VALUES ($1, 'Camp A session'), ($2, 'Camp B session') RETURNING id`,
      [ids.campA, ids.campB],
    );
    [ids.sessionA, ids.sessionB] = sessions.rows.map(r => r.id);
    actorA = { userId: ids.userA, orgId: ids.campA, role: 'admin' };
    actorB = { userId: ids.userB, orgId: ids.campB, role: 'admin' };
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[ids.campA, ids.campB]]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ids.userA, ids.userB]]).catch(() => {});
    await pool.end();
  });

  it('a form and its submission are visible only to their own camp', async () => {
    const form = await service.createForm(actorA, formInput([ids.sessionA]));
    await service.publishForm(actorA, form.id);
    await service.submit({ userId: ids.userA, orgId: ids.campA, role: 'staff' }, form.id, {
      formId: form.id,
      sessionIds: [ids.sessionA],
      standard,
      custom: { photos: 'yes' },
    });

    expect(await repo.getForm(ids.userB, ids.campB, form.id)).toBeNull();
    expect(await repo.getPublishedVersion(ids.userB, ids.campB, form.id)).toBeNull();
    expect((await repo.listForms(ids.userB, ids.campB)).map(f => f.id)).not.toContain(form.id);
    expect((await repo.listSubmissions(ids.userA, ids.campA, form.id)).length).toBe(1);
    await expect(repo.listSubmissions(ids.userB, ids.campB, form.id)).rejects.toMatchObject({
      kind: 'registration-form-not-found',
    });
  });

  it('a camp cannot register for another camp’s form or session', async () => {
    const form = await service.createForm(actorA, formInput([ids.sessionA]));
    await service.publishForm(actorA, form.id);

    await expect(
      service.submit(actorB, form.id, {
        formId: form.id,
        sessionIds: [ids.sessionB],
        standard,
        custom: { photos: 'no' },
      }),
    ).rejects.toMatchObject({ kind: 'registration-form-not-found' });
    await expect(service.createForm(actorB, formInput([ids.sessionA]))).rejects.toMatchObject({
      kind: 'registration-session-not-found',
    });
  });

  it('row-level security hides another camp’s registration rows from a direct read', async () => {
    const form = await service.createForm(actorB, formInput([ids.sessionB]));
    await service.publishForm(actorB, form.id);
    await service.submit(actorB, form.id, {
      formId: form.id,
      sessionIds: [ids.sessionB],
      standard,
      custom: { photos: 'yes' },
    });

    const seenByA = await withOrg(pool, ids.userA, ids.campA, db =>
      db.query<{ id: string }>('SELECT id FROM registrations WHERE form_id = $1', [form.id]),
    );
    expect(seenByA.rowCount).toBe(0);
    const sessionsSeenByA = await withOrg(pool, ids.userA, ids.campA, db =>
      db.query<{ registration_id: string }>('SELECT registration_id FROM registration_sessions WHERE session_id = $1', [
        ids.sessionB,
      ]),
    );
    expect(sessionsSeenByA.rowCount).toBe(0);
  });

  it('a refused registration writes nothing, and an unpublished form refuses', async () => {
    const form = await service.createForm(actorA, formInput([ids.sessionA]));
    const before = await repo.listSubmissions(ids.userA, ids.campA, form.id);
    await expect(
      service.submit(actorA, form.id, {
        formId: form.id,
        sessionIds: [ids.sessionA],
        standard,
        custom: { photos: 'yes' },
      }),
    ).rejects.toBeInstanceOf(RegistrationRefusedError);
    expect(await repo.listSubmissions(ids.userA, ids.campA, form.id)).toEqual(before);
  });

  it('a registration is recorded pending, a staff member confirms it once, and both are audited', async () => {
    const staffA: Actor = { userId: ids.userA, orgId: ids.campA, role: 'staff' };
    const form = await service.createForm(actorA, formInput([ids.sessionA]));
    await service.publishForm(actorA, form.id);
    const id = await service.submit(staffA, form.id, {
      formId: form.id,
      sessionIds: [ids.sessionA],
      standard,
      custom: { photos: 'yes' },
    });
    const [pending] = await repo.listSubmissions(ids.userA, ids.campA, form.id);
    expect(pending).toMatchObject({ id, status: 'pending', confirmedAt: null });

    await service.confirm(staffA, id);
    await expect(service.confirm(staffA, id)).rejects.toMatchObject({ reason: 'already_confirmed' });

    const [confirmed] = await repo.listSubmissions(ids.userA, ids.campA, form.id);
    expect(confirmed.status).toBe('confirmed');
    const audit = await withOrg(pool, ids.userA, ids.campA, db =>
      db.query<{ action: string }>('SELECT action FROM audit_log WHERE entity_id = $1', [id]),
    );
    expect(audit.rows.map(r => r.action).sort()).toEqual(['registration.confirm', 'registration.submit']);
  });
});
