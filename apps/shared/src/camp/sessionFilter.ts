/*
 * The session filter on the camp-wide Registration and Holds pages. The chosen session is in the URL as `?session=<id>`, so refresh
 * and back keep it. `?session=` (empty) is All sessions. With no `session` in the URL, the page opens on the one live session when
 * there is exactly one; otherwise on All sessions.
 */
import type { Session } from '@buxa/contracts';

/** The value of the All sessions choice. */
export const ALL_SESSIONS = '';

/** The query parameter the filter writes. */
export const SESSION_PARAM = 'session';

export interface SessionChoice {
  id: string;
  name: string;
}

export interface SessionFilterOption {
  value: string;
  label: string;
}

/**
 * Every session a camp list can filter by: the camp's sessions, plus any session a row names that the session list did not return
 * (so a reader without the session list still gets a filter). Each session appears once.
 */
export function knownSessions(
  sessions: readonly SessionChoice[],
  rows: readonly { sessionId: string; sessionName: string }[],
): SessionChoice[] {
  const byId = new Map<string, SessionChoice>();
  for (const session of sessions) {
    byId.set(session.id, session);
  }
  for (const row of rows) {
    if (!byId.has(row.sessionId)) {
      byId.set(row.sessionId, { id: row.sessionId, name: row.sessionName });
    }
  }

  return [...byId.values()];
}

/** The filter's options: All sessions first, then each session by name (ties by id, so the order is stable). */
export function sessionFilterOptions(sessions: readonly SessionChoice[]): SessionFilterOption[] {
  const sorted = [...sessions].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  return [{ value: ALL_SESSIONS, label: 'All sessions' }, ...sorted.map(s => ({ value: s.id, label: s.name }))];
}

/** The session the filter opens on when the URL names none: the one live session, or All sessions when there is not exactly one. */
export function defaultSessionChoice(sessions: readonly Pick<Session, 'id' | 'status'>[]): string {
  const live = sessions.filter(session => session.status === 'live');
  const [only] = live;

  return live.length === 1 && only ? only.id : ALL_SESSIONS;
}

/**
 * The session the filter shows. A missing parameter takes `fallback`; an empty one is All sessions; an id the page does not know
 * (or a repeated parameter) is All sessions too, so a stale link never hides everything.
 */
export function chosenSession(
  requested: string | string[] | undefined,
  known: readonly SessionChoice[],
  fallback: string = ALL_SESSIONS,
): string {
  if (requested === undefined) {
    return fallback;
  }
  if (typeof requested !== 'string') {
    return ALL_SESSIONS;
  }

  return known.some(session => session.id === requested) ? requested : ALL_SESSIONS;
}

/** Whether a row that belongs to `sessionId` is shown under the chosen session. */
export function inChosenSession(sessionId: string, chosen: string): boolean {
  return chosen === ALL_SESSIONS || sessionId === chosen;
}
