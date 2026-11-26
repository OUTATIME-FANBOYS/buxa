import Link from 'next/link';
import type { Household } from '@buxa/contracts';
import { householdPath, peopleTabPath } from '@/config/routes';
import { Button, Pill } from '@/components/elements';
import { householdRoleLabel } from './householdRoles';

export interface HouseholdPanelProps {
  personId: string;
  /** The households this person belongs to. */
  households: readonly Household[];
}

/**
 * The household card on a person's page: links only. It names each household this person belongs to, their role in it and whether
 * they may collect a child, and opens the household's page. Every edit happens on that page, not here.
 */
export function HouseholdPanel({ personId, households }: HouseholdPanelProps) {
  return (
    <section className="panel stack" aria-labelledby="household-heading">
      <h2 id="household-heading" className="people-heading">
        Household
      </h2>
      {households.length === 0 && (
        <p className="muted">
          Not in a household yet.{' '}
          <Link className="link" href={peopleTabPath('households')}>
            Open the Households tab
          </Link>
        </p>
      )}
      {households.map(household => {
        const me = household.members.find(member => member.personId === personId);

        return (
          <div key={household.id} className="stack people-subpanel">
            <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-between buxa:gap-2">
              <h3 className="people-subheading">{household.name}</h3>
              <Button href={householdPath(household.id)} size="sm">
                Open household
              </Button>
            </div>
            {me ? (
              <div className="row">
                <Pill tone="neutral">{householdRoleLabel(me)}</Pill>
                {me.canPickup === true && <Pill tone="ok">Can collect child</Pill>}
              </div>
            ) : (
              <p className="muted">Not listed in this household.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
