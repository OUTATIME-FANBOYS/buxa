import type { LogFilterChoices } from './types';

type ClassChoice = LogFilterChoices['classes'][number];

/** The classes the log's Class list offers: every class when no session is chosen (''), otherwise the chosen session's. */
export function classesOfSession(classes: readonly ClassChoice[], sessionId: string): ClassChoice[] {
  return sessionId === '' ? [...classes] : classes.filter(c => c.sessionId === sessionId);
}

/**
 * The Class choice after the Session choice changes. It stays when it is still offered (under the new session, or any session when
 * "All sessions" is chosen); otherwise it goes back to "All classes" (''), so the form never submits a class from another session.
 */
export function classAfterSessionChange(classId: string, classes: readonly ClassChoice[], sessionId: string): string {
  if (classId === '') {
    return '';
  }
  const stillOffered = classes.some(c => c.id === classId && (sessionId === '' || c.sessionId === sessionId));

  return stillOffered ? classId : '';
}
