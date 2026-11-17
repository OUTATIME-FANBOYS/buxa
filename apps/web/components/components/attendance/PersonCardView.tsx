import type { ReactNode } from 'react';
import { CAMP_ROLE_LABELS } from '@buxa/domain';
import type { PersonCard } from '@buxa/shared';
import { attendanceDisplayName } from '@buxa/shared';
import { formatCampTime } from '@buxa/shared';
import { StatusPill } from './StatusPill';
import type { ClockFormat } from '@buxa/domain';

interface Props { card: PersonCard; timeZone: string; clockFormat: ClockFormat; children: ReactNode }

/** The person as the desk needs them: a big name, what they are, their status in words, and since when they are on site. */
export function PersonCardView({ card, timeZone, clockFormat, children }: Props) {
  const { person, onSiteSince } = card;
  const roles = person.roles.map(role => CAMP_ROLE_LABELS[role]).join(', ');
  return (
    <article className="result-card" aria-labelledby="result-name">
      <h2 id="result-name" className="result-name">{attendanceDisplayName(person)}</h2>
      {roles && <p className="muted">{roles}</p>}
      <div className="row"><StatusPill status={person.status} /></div>
      {onSiteSince && <p className="result-since">On site since {formatCampTime(onSiteSince, timeZone, clockFormat)}</p>}
      <div className="result-action">{children}</div>
    </article>
  );
}
