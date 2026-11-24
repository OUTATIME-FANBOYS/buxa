import type { SessionStatus } from '@buxa/contracts';

/** How a session's status reads in the list and in the Edit dialog. Draft is not open yet, Live takes registrations, Archived is closed. */
export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: 'ok' | 'warn' | 'neutral'; note: string }> = {
  draft: {
    label: 'Draft',
    tone: 'warn',
    note: 'This session is a draft. Registration and enrolment are closed until it goes live.',
  },
  live: {
    label: 'Live',
    tone: 'ok',
    note: 'This session is live. Registration and enrolment are open.',
  },
  archived: {
    label: 'Archived',
    tone: 'neutral',
    note: 'This session is archived. It is closed and hidden from registration and its public page.',
  },
};
