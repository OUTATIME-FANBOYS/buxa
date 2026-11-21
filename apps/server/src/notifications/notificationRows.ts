import type { PoolClient } from 'pg';
import { NOTIFICATION_LIMIT, type NotificationKind } from './rules';

/** A notification as a screen reads it. Row-level security returns only the signed-in user's own rows. */
export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  link: string;
  createdAt: string;
  readAt: string | null;
}

interface Row {
  id: string;
  kind: NotificationKind;
  title: string;
  link: string;
  created_at: Date;
  read_at: Date | null;
}

const toRow = (row: Row): NotificationRow => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  link: row.link,
  createdAt: row.created_at.toISOString(),
  readAt: row.read_at ? row.read_at.toISOString() : null,
});

/** The newest notifications of the signed-in user, capped at NOTIFICATION_LIMIT, and how many of them are unread. */
export async function listNotificationRows(
  db: Pick<PoolClient, 'query'>,
): Promise<{ rows: NotificationRow[]; unread: number }> {
  const listed = await db.query<Row>(
    `SELECT id, kind, title, link, created_at, read_at FROM notifications
     ORDER BY created_at DESC, id DESC LIMIT $1`,
    [NOTIFICATION_LIMIT],
  );
  const unread = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM notifications WHERE read_at IS NULL',
  );

  return { rows: listed.rows.map(toRow), unread: Number(unread.rows[0]?.count ?? 0) };
}

/**
 * Marks the given notifications read, or all of the signed-in user's unread ones when `ids` is null. Row-level security limits the
 * update to the user's own rows; the app role may change read_at only.
 */
export async function markNotificationsRead(
  db: Pick<PoolClient, 'query'>,
  ids: readonly string[] | null,
): Promise<void> {
  if (ids === null) {
    await db.query('UPDATE notifications SET read_at = now() WHERE read_at IS NULL');

    return;
  }
  await db.query('UPDATE notifications SET read_at = now() WHERE read_at IS NULL AND id = ANY($1::uuid[])', [ids]);
}
