import type { ActiveEnrolmentFacts, EnrolmentDecision } from './enrolment';

/** The reasons a person reads when an enrolment is refused. One source for the API and the screens. */
export type Refusal = Extract<EnrolmentDecision, { kind: 'refuse' }>;

/** "Mon 5 Jul, 11:00-13:00" in the camp's zone. The end is repeated with its day only when it falls on another day. */
export function formatClash(clash: Pick<ActiveEnrolmentFacts, 'startsAt' | 'endsAt'>, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const start = new Date(clash.startsAt);
  const end = new Date(clash.endsAt);
  const sameDay = day.format(start).split(',')[0] === day.format(end).split(',')[0];
  return `${day.format(start)}-${sameDay ? clock.format(end) : day.format(end)}`;
}

export function describeRefusal(r: Refusal, timeZone: string): string {
  switch (r.reason) {
    case 'age_unknown':
      return 'Add this camper\'s date of birth before enrolling them, so their age can be checked.';
    case 'age_out_of_range':
      return `This class is for ages ${r.range.minAge} to ${r.range.maxAge}. The camper is ${r.age} on the day of the session.`;
    case 'overlap':
      return `This clashes with ${r.clash.className} (${formatClash(r.clash, timeZone)}), which the camper is already enrolled in.`;
    case 'session_full':
      return `This session is full (${r.capacity} places). The camper can be put on the waitlist instead.`;
    case 'override_needs_reason':
      return 'Give a reason for overriding the clash.';
    case 'override_not_allowed':
      return 'Only an admin can override a clash.';
  }
}
