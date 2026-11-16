import type { CheckInResult, CheckOutResult } from '@/server/services';
import { formatCampTime } from './time';
import { STATUS_DISPLAY } from './status';

export type CheckInRefusal = Extract<CheckInResult, { ok: false }>;
export type CheckOutRefusal = Extract<CheckOutResult, { ok: false }>;

/** A refusal in plain words: a title for the person, and what to do next. */
export interface Copy { title: string; body: string }

const OVERRIDE_HINT = 'An admin can check them in anyway with a written reason.';
const REASON_NEEDED = 'An override needs a written reason, so it is on record.';

/** Every CheckInResult refusal, with the camp's local time where a time is shown. */
export function checkInRefusalCopy(refusal: CheckInRefusal, timeZone: string): Copy {
  switch (refusal.reason) {
    case 'already_on_site':
      return { title: 'Already on site', body: `Checked in at ${formatCampTime(refusal.since, timeZone)}. Nothing to do.` };
    case 'not_valid': {
      const label = STATUS_DISPLAY[refusal.status].label;
      const why: Record<typeof refusal.status, string> = {
        not_started: 'Their membership has not started yet.',
        expired: 'Their membership has ended.',
        revoked: 'Their membership was revoked.',
        none: 'They have no membership for this camp.',
      };
      return { title: label, body: refusal.canOverride ? `${why[refusal.status]} ${OVERRIDE_HINT}` : why[refusal.status] };
    }
    case 'override_needs_reason':
      return { title: 'Write a reason', body: REASON_NEEDED };
    case 'archived':
      return { title: 'Archived', body: 'This person is archived. Ask an admin to check their record.' };
  }
}

/** Every CheckOutResult refusal. The guardian list is shown by the row itself, so the copy only says what is wrong. */
export function checkOutRefusalCopy(refusal: CheckOutRefusal): Copy {
  switch (refusal.reason) {
    case 'not_on_site':
      return { title: 'Not on site', body: 'They have already checked out, or never arrived.' };
    case 'pickup_required':
      return refusal.guardians.length > 0
        ? { title: 'Choose who is collecting', body: 'A child can only leave with a guardian who may collect them.' }
        : { title: 'No guardian to collect', body: `No guardian who may collect this child is linked. ${refusal.canOverride ? 'An admin can check them out with a written reason.' : 'Ask an admin.'}` };
    case 'pickup_not_authorised':
      return { title: 'Not an authorised guardian', body: 'That person may not collect this child. Choose another guardian.' };
    case 'override_needs_reason':
      return { title: 'Write a reason', body: REASON_NEEDED };
  }
}
