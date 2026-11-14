import type { ReactNode } from 'react';
import { CAMP_ROLE_LABELS } from '@buxa/domain';
import type { PersonCard } from '../lib/card';
import { displayName } from '../lib/name';
import { formatCampTime } from '../lib/time';
import { StatusPill } from './StatusPill';

interface Props { card: PersonCard; timeZone: string; children: ReactNode }

/** The person as the desk needs them: a big name, what they are, their status in words, and since when they are on site. */
export function PersonCardView({ card, timeZone, children }: Props) {
  const { person, onSiteSince } = card;
  const roles = person.roles.map(role => CAMP_ROLE_LABELS[role]).join(', ');
  return (
    <article className="result-card" aria-labelledby="result-name">
      <h2 id="result-name" className="result-name">{displayName(person)}</h2>
      {roles && <p className="muted">{roles}</p>}
      <div className="row"><StatusPill status={person.status} /></div>
      {onSiteSince && <p className="result-since">On site since {formatCampTime(onSiteSince, timeZone)}</p>}
      <div className="result-action">{children}</div>
    </article>
  );
}
