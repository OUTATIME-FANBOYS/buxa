import { checkInRefusalCopy } from '../lib/refusals';
import { displayName } from '../lib/name';
import { STATUS_DISPLAY } from '../lib/status';
import { formatCampTime } from '../lib/time';
import type { CheckInState } from './checkInState';

/** What a screen reader should hear for this state. Empty when there is nothing new to say. */
export function checkInAnnouncement(state: CheckInState, timeZone: string): string {
  switch (state.phase) {
    case 'idle': return '';
    case 'unknown': return 'Code not recognised.';
    case 'error': return state.message;
    case 'ready': return `${displayName(state.card.person)}. ${STATUS_DISPLAY[state.card.person.status].label}.`;
    case 'submitting': return 'Checking in.';
    case 'refused': {
      const copy = checkInRefusalCopy(state.refusal, timeZone);
      return `${copy.title}. ${copy.body}`;
    }
    case 'failed': return state.message;
    case 'done': return `${displayName(state.card.person)} checked in at ${formatCampTime(state.entry.checkedInAt, timeZone)}.`;
  }
}
