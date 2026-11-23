import { timingSafeEqual } from 'node:crypto';

/*
 * The check a scheduled job route makes before it does any work. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The secret
 * comes from the validated config, never from a request. With no secret configured (or one shorter than 16 characters) the job
 * refuses (503), so a missing variable can never leave the route open. A wrong or missing header is refused with 401.
 */

const MIN_SECRET_LENGTH = 16;

export type CronCheck = { ok: true } | { ok: false; status: 401 | 503; message: string };

export function checkCronSecret(authorization: string | null, secret: string | undefined): CronCheck {
  if (secret === undefined || secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      status: 503,
      message: 'CRON_SECRET is not set (16 characters or more), so scheduled jobs are refused.',
    };
  }
  if (authorization === null) {
    return { ok: false, status: 401, message: 'A scheduled job needs the cron secret.' };
  }
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, message: 'The cron secret does not match.' };
  }

  return { ok: true };
}
