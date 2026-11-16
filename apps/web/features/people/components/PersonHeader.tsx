import type { Person } from '@buxa/contracts';
import { Pill } from '@/components/ui';
import { AccessPill } from './AccessPill';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';
import { displayName } from '../lib/format';

/** Name, roles and the two status words that matter at the door: membership and on site. Archived people say so in words. */
export function PersonHeader({ person }: { person: Person }) {
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
      </div>
    </header>
  );
}
