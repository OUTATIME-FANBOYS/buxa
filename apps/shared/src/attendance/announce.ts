import type { ClockFormat } from '@buxa/domain';
import { checkInRefusalCopy } from './refusals';
import { displayName } from '../name';
import { STATUS_DISPLAY } from './status';
import { formatCampTime } from '../time';
import type { CheckInState } from './checkInState';

/** What a screen reader should hear for this state. Empty when there is nothing new to say. */
export function checkInAnnouncement(state: CheckInState, timeZone: string, clockFormat: ClockFormat): string {
  switch (state.phase) {
    case 'idle': return '';
    case 'unknown': return 'Code not recognised.';
    case 'error': return state.message;
    case 'ready': {
      const { status } = state.card.person;

      return `${displayName(state.card.person)}.${status === null ? '' : ` ${STATUS_DISPLAY[status].label}.`}`;
    }
    case 'submitting': return 'Checking in.';
    case 'refused': {
      const copy = checkInRefusalCopy(state.refusal, timeZone, clockFormat);

      return `${copy.title}. ${copy.body}`;
    }
    case 'failed': return state.message;
    case 'done': return `${displayName(state.card.person)} checked in at ${formatCampTime(state.entry.checkedInAt, timeZone, clockFormat)}.`;
  }
}
