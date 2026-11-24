/** A session that a delete removed. */
export interface DeletedSession {
  id: string;
  name: string;
}

/** A session that a delete refused: `code` is the service's reason, `reason` is the copy a person reads. */
export interface RefusedSession extends DeletedSession {
  code: string;
  reason: string;
}

export interface SessionDeletionDone {
  status: 'done';
  deleted: readonly DeletedSession[];
  refused: readonly RefusedSession[];
}

/** The result of deleting one or more sessions: idle, the per-session outcome, or a failure for the whole request. */
export type SessionDeletion = { status: 'idle' } | SessionDeletionDone | { status: 'error'; message: string };

export const idleSessionDeletion: SessionDeletion = { status: 'idle' };

/** The short reason shown after a session's name in "Not deleted: Art (has classes; archive it instead)." */
const SHORT_REASON: Partial<Record<string, string>> = {
  session_has_classes: 'has classes; archive it instead',
  session_has_enrolments: 'has enrolments; unenrol everyone first',
  session_not_found: 'already gone',
};
const NAMED_LIMIT = 3;

/** "Deleted 2 sessions." or "Deleted 1 session." */
export function deletedMessage(count: number): string {
  return `Deleted ${count} ${count === 1 ? 'session' : 'sessions'}.`;
}

/** "Not deleted: Art (has classes; archive it instead), Music (has classes; archive it instead) and 2 more." Null when nothing was refused. */
export function notDeletedMessage(refused: readonly RefusedSession[]): string | null {
  if (refused.length === 0) {
    return null;
  }
  const named = refused
    .slice(0, NAMED_LIMIT)
    .map(session => `${session.name} (${SHORT_REASON[session.code] ?? 'not allowed'})`);
  const more = refused.length - NAMED_LIMIT;

  return `Not deleted: ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`;
}

/** The session name carried in `?deleted=`, or null unless it is a non-empty string. Anything else is ignored. */
export function deletedSessionName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const name = value.trim();

  return name === '' ? null : name;
}

/** The most sessions one bulk delete takes. Kept here, not in the server action file, because 'use server' files export only actions. */
export const MAX_SESSION_DELETES = 100;

/** The longest session name carried in the `deleted` query parameter of the sessions list. */
export const DELETED_NAME_LIMIT = 120;
