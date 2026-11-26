import type { Household } from '@buxa/contracts';
import { householdPath, ROUTES } from '@/config/routes';
import { Button } from '@/components/elements';
import { LinkHouseholdForm, type PersonOption } from '@/components/components/people/forms';
import { PersonFinder } from '@/components/components/people/forms';
import { HouseholdMemberRow } from './HouseholdMemberRow';

export interface HouseholdEditorProps {
  household: Household;
  canUpdate: boolean;
  canCreate: boolean;
  /** Whether the pick-up flag can be set when linking (people:authorise_pickup, admin and above). */
  canAuthorisePickup: boolean;
  /** The search for someone to link, from `?q=`; empty until staff search. */
  query: string;
  /** People matching `query`, to link into this household. */
  linkable: readonly PersonOption[];
}

/**
 * Everything that changes one household: its members (remove, with their guardian and pick-up flags), adding a child, and linking
 * someone in by name. The server checks each action again; these controls only show what the viewer may do.
 */
export function HouseholdEditor({
  household,
  canUpdate,
  canCreate,
  canAuthorisePickup,
  query,
  linkable,
}: HouseholdEditorProps) {
  return (
    <div className="stack">
      <section className="panel stack" aria-labelledby="household-members-heading">
        <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-between buxa:gap-2">
          <h2 id="household-members-heading" className="people-heading">
            Members
          </h2>
          {canCreate && (
            <Button href={`${ROUTES.newPerson}?household=${encodeURIComponent(household.id)}`}>
              Add a child to this household
            </Button>
          )}
        </div>
        {household.members.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <ul className="people-list" aria-label={`Members of ${household.name}`}>
            {household.members.map(member => (
              <HouseholdMemberRow
                key={member.personId}
                member={member}
                householdId={household.id}
                canUpdate={canUpdate}
              />
            ))}
          </ul>
        )}
      </section>
      {canUpdate && (
        <section className="panel stack" aria-labelledby="household-link-heading">
          <h2 id="household-link-heading" className="people-heading">
            Link someone to this household
          </h2>
          <PersonFinder action={householdPath(household.id)} query={query} />
          {query === '' && <p className="muted">Search by name to find someone in the camp.</p>}
          {query !== '' && linkable.length === 0 && <p className="muted">No one matches that search.</p>}
          {linkable.length > 0 && (
            <LinkHouseholdForm
              households={[{ id: household.id, name: household.name }]}
              people={linkable}
              canAuthorisePickup={canAuthorisePickup}
            />
          )}
        </section>
      )}
    </div>
  );
}
