import Link from 'next/link';
import type { Household } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { LinkHouseholdForm, type HouseholdOption, type PersonOption } from '@/components/components/people/forms/export';
import { PersonFinder } from '@/components/components/people/forms/export';
import { HouseholdMemberRow } from './HouseholdMemberRow';

export interface HouseholdPanelProps {
  personId: string;
  /** The households this person belongs to. */
  households: readonly Household[];
  /** Every household in the camp, for the link form. */
  householdOptions: readonly HouseholdOption[];
  canUpdate: boolean;
  canCreate: boolean;
  /** Whether the pick-up flag can be set when linking (people:authorise_pickup, admin and above). */
  canAuthorisePickup: boolean;
  /** The search for someone to link, from `?q=`; empty until staff search. */
  query: string;
  /** People matching `query` (never this person). */
  linkable: readonly PersonOption[];
}

/**
 * The households this person belongs to, with each member's guardian and pick-up status. Staff can link anyone in the camp to any
 * household: they search by name first, then choose from the matches. Adding a child starts from here too.
 */
export function HouseholdPanel({ personId, households, householdOptions, canUpdate, canCreate, canAuthorisePickup, query, linkable }: HouseholdPanelProps) {
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
      {canUpdate && householdOptions.length > 0 && (
        <div className="stack people-subpanel">
          <h3 className="people-subheading">Link someone to a household</h3>
          <PersonFinder personId={personId} query={query} />
          {query === '' && <p className="muted">Search by name to find someone in the camp.</p>}
          {query !== '' && linkable.length === 0 && <p className="muted">No one matches that search.</p>}
          {linkable.length > 0 && <LinkHouseholdForm households={householdOptions} people={linkable} canAuthorisePickup={canAuthorisePickup} />}
        </div>
      )}
    </section>
  );
}
