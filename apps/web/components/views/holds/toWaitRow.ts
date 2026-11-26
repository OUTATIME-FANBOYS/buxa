import type { WaitRow } from '@/components/components/holds';
import type { CampWaitlistEntry } from '@buxa/server/classes/ClassRepository';

/** The waitlist row the board shows: the enrolment's id is the row key. */
export const toWaitRow = (row: CampWaitlistEntry): WaitRow => ({
  id: row.enrolmentId,
  sessionId: row.sessionId,
  sessionName: row.sessionName,
  classId: row.classId,
  className: row.className,
  householdName: row.householdName,
  camperName: row.camperName,
  joinedAt: row.joinedAt,
});
