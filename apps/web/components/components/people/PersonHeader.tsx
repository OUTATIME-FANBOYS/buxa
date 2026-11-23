import type { ReactNode } from 'react';
import type { Person } from '@buxa/contracts';
import { Pill } from '@/components/elements';
import { AccessPill } from './AccessPill';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';
import { displayName } from '@buxa/shared';

/**
 * The name, then the role and status words (membership and on site; archived people say so in words), then the email on its own
 * muted line. `actions` sit on the right of the same line as the name block.
 */
export function PersonHeader({ person, actions }: { person: Person; actions?: ReactNode }) {
  return (
    <header className="page-head people-head">
      <div className="page-title">
        <h1>{displayName(person)}</h1>
        <div className="row">
          <RolePills roles={person.roles} />
          <AccessPill status={person.status} />
          <OnSitePill onSite={person.onSite} />
          {person.archived && <Pill tone="neutral">Archived</Pill>}
        </div>
        {person.email && <p className="muted people-email">{person.email}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
