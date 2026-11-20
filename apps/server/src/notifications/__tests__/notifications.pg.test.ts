import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { recordAudit } from '../../audit/recordAudit';
import { listNotificationRows, markNotificationsRead } from '../notificationRows';

const url = process.env.DATABASE_URL;

// Migration 0037: a user reads, and marks read, only their own notifications, in their own camp. The rows come from recordAudit,
// in the same transaction as the write.
describe.skipIf(!url)('notifications (0037)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let camp = '';
  let otherCamp = '';
  let owner = '';
  let staff = '';
  let viewer = '';
  let outsider = '';
  let staffRow = '';

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Staff'), ($3, 'Viewer'), ($4, 'Outsider') RETURNING id`,
      [
        `owner-${tag}@notify.test`,
        `staff-${tag}@notify.test`,
        `viewer-${tag}@notify.test`,
        `outsider-${tag}@notify.test`,
      ],
    );
    [owner, staff, viewer, outsider] = users.rows.map(r => r.id);
    const orgs = await pool.query<{ id: string }>(
      `INSERT INTO orgs (name, slug) VALUES ($1, $2), ($3, $4) RETURNING id`,
      [`Notify ${tag}`, `notify-${tag}`, `Other ${tag}`, `other-${tag}`],
    );
    [camp, otherCamp] = orgs.rows.map(r => r.id);
    await pool.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'staff'), ($1, $4, 'viewer')`,
      [camp, owner, staff, viewer],
    );
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [otherCamp, outsider]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('a user reads only their own notifications, and an outsider reads none of this camp’s', async () => {
    await pool.query(
      `INSERT INTO notifications (org_id, user_id, kind, title, link) VALUES ($1, $2, 'people', 'Seed row', '/camp/people')`,
      [camp, staff],
    );
    const {
      rows: [mine],
    } = await pool.query<{ id: string }>(`SELECT id FROM notifications WHERE org_id = $1 AND user_id = $2 LIMIT 1`, [
      camp,
      staff,
    ]);
    staffRow = mine?.id ?? '';

    const viewerSees = await withOrg(pool, viewer, camp, listNotificationRows);
    expect(viewerSees.rows.every(row => row.id !== staffRow)).toBe(true);
    const outsiderSees = await withOrg(pool, outsider, camp, listNotificationRows);
    expect(outsiderSees.rows).toEqual([]);
  });

  it('another user cannot read a notification by its id', async () => {
    const found = await withOrg(pool, viewer, camp, db =>
      db.query<{ id: string }>('SELECT id FROM notifications WHERE id = $1', [staffRow]),
    );
    expect(found.rows).toEqual([]);
  });

  it('another user cannot mark it read: the row stays unread', async () => {
    await withOrg(pool, viewer, camp, db => markNotificationsRead(db, [staffRow]));
    const { rows } = await pool.query<{ read_at: Date | null }>('SELECT read_at FROM notifications WHERE id = $1', [
      staffRow,
    ]);
    expect(rows[0]?.read_at).toBeNull();
  });

  it('the recipient marks their own notification read, and it reads as read', async () => {
    await withOrg(pool, staff, camp, db => markNotificationsRead(db, [staffRow]));
    const seen = await withOrg(pool, staff, camp, listNotificationRows);
    expect(seen.rows.find(row => row.id === staffRow)?.readAt).not.toBeNull();
  });

  it('a write notifies the people who may see it, in the same transaction, and not the person who made it', async () => {
    const personId = randomUUID();
    await withOrg(pool, staff, camp, db =>
      recordAudit(db, {
        actor: { userId: staff, orgId: camp },
        action: 'person.create',
        entity: 'person',
        entityId: personId,
      }),
    );
    const owners = await withOrg(pool, owner, camp, listNotificationRows);
    expect(owners.rows.some(row => row.title === 'Person added')).toBe(true);
    const viewers = await withOrg(pool, viewer, camp, listNotificationRows);
    expect(viewers.rows.some(row => row.title === 'Person added')).toBe(true);
    const actor = await withOrg(pool, staff, camp, listNotificationRows);
    expect(actor.rows.filter(row => row.title === 'Person added')).toHaveLength(0);
  });

  it('a list shows at most 50, the newest first', async () => {
    const batch = await withOrg(pool, owner, camp, db => listNotificationRows(db));
    expect(batch.rows.length).toBeLessThanOrEqual(50);
    await pool.query(
      `INSERT INTO notifications (org_id, user_id, kind, title, link)
       SELECT $1, $2, 'people', 'Bulk ' || g, '/camp/people' FROM generate_series(1, 60) g`,
      [camp, owner],
    );
    const capped = await withOrg(pool, owner, camp, db => listNotificationRows(db));
    expect(capped.rows).toHaveLength(50);
    expect(capped.rows[0]?.createdAt >= capped.rows[49]?.createdAt).toBe(true);
  });

  it('a row written for one camp is not visible in another camp', async () => {
    await pool.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer') ON CONFLICT DO NOTHING`,
      [otherCamp, viewer],
    );
    const elsewhere = await withOrg(pool, viewer, otherCamp, listNotificationRows);
    expect(elsewhere.rows.every(row => row.id !== staffRow)).toBe(true);
  });
});
