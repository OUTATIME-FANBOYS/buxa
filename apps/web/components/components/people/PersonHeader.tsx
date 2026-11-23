import type { ReactNode } from 'react';
import type { Person } from '@buxa/contracts';
import { Pill } from '@/components/elements';
import { AccessPill } from './AccessPill';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';
import { displayName, formatLocalDate } from '@buxa/shared';

/**
 * The name, then the role and status words (membership and on site; archived people say so in words), then the email on its own
 * muted line, then date of birth and phone as one muted line ("Born 12 Mar 2010 · +1 555 0100"). A value the server withholds
 * (null for roles without contact access) or that is empty is left out; with neither, no line. `actions` sit on the right of the
 * same line as the name block.
 */
export function PersonHeader({ person, actions }: { person: Person; actions?: ReactNode }) {
  const contact = [person.dateOfBirth ? `Born ${formatLocalDate(person.dateOfBirth)}` : '', person.phone ?? '']
    .map(part => part.trim())
    .filter(part => part !== '');

  return (
    <header className="page-head people-head">
      <div className="page-title">
        <h1>{displayName(person)}</h1>
        {person.email && <p className="muted people-email">{person.email}</p>}
        {contact.length > 0 && <p className="muted people-contact">{contact.join(' · ')}</p>}
        <div className="row people-tags">
          <RolePills roles={person.roles} />
          <AccessPill status={person.status} />
          <OnSitePill onSite={person.onSite} />
          {person.archived && <Pill tone="neutral">Archived</Pill>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
