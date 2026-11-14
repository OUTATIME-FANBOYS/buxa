import Link from 'next/link';
import type { Household } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { LinkHouseholdForm, type PersonOption } from '../forms/LinkHouseholdForm';
import { HouseholdMemberRow } from './HouseholdMemberRow';

export interface HouseholdPanelProps {
  households: readonly Household[];
  canUpdate: boolean;
  canCreate: boolean;
  /** Other people who can be linked in (for the link form). Empty when the viewer cannot link people. */
  linkable: readonly PersonOption[];
}

/** The households this person belongs to, with each member's guardian and pick-up status. Staff can link people and add a child here. */
export function HouseholdPanel({ households, canUpdate, canCreate, linkable }: HouseholdPanelProps) {
  return (
    <section className="panel" aria-labelledby="household-heading">
      <h2 id="household-heading" className="people-heading">Household</h2>
      {households.length === 0 && <p className="muted">Not in a household yet.</p>}
      {households.map(household => (
        <div key={household.id} className="stack">
          <h3 className="people-subheading">{household.name}</h3>
          <ul className="people-list" aria-label={`Members of ${household.name}`}>
            {household.members.map(member => (
              <HouseholdMemberRow key={member.personId} member={member} householdId={household.id} canUpdate={canUpdate} />
            ))}
          </ul>
          {canCreate && <p><Link className="btn btn-sm" href={`${ROUTES.newPerson}?household=${encodeURIComponent(household.id)}`}>Add a child to this household</Link></p>}
        </div>
      ))}
      {canUpdate && households.length > 0 && linkable.length > 0 && (
        <LinkHouseholdForm households={households.map(h => ({ id: h.id, name: h.name }))} people={linkable} />
      )}
    </section>
  );
}
