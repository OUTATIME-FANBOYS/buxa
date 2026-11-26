import type { Household } from '@buxa/contracts';
import { householdPath, ROUTES } from '@/config/routes';
import { Button, Pill } from '@/components/elements';
import { HiddenField, SearchField } from '@/components/atoms';
import { householdRoleLabel } from './householdRoles';

const countLine = (n: number) => (n === 1 ? '1 household' : `${n} households`);

/**
 * The Households tab: every household in the camp with its members and their roles, and a link to each household's page. Search is by
 * household name. There is no add button here: households are made from the add-person form, and edited on their own page.
 */
export function HouseholdDirectory({ households, query }: { households: readonly Household[]; query: string }) {
  const needle = query.trim().toLowerCase();
  const shown = needle === '' ? households : households.filter(h => h.name.toLowerCase().includes(needle));

  return (
    <div className="stack">
      <form
        role="search"
        method="get"
        action={ROUTES.people}
        className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none"
      >
        <HiddenField name="tab" value="households" />
        <SearchField label="Search households by name" name="q" defaultValue={query} maxLength={80} autoComplete="off" />
        <Button type="submit" iconOnly icon="search" aria-label="Search households by name" />
      </form>
      {households.length === 0 && <p className="muted">No households yet. A family appears here once a child is added to it.</p>}
      {households.length > 0 && shown.length === 0 && <p className="muted">No household matches that search.</p>}
      {shown.length > 0 && (
        <>
          <p className="muted">{countLine(shown.length)}</p>
          <ul className="stack" aria-label="Households">
            {shown.map(household => (
              <li key={household.id} className="panel stack">
                <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-between buxa:gap-2">
                  <h2 className="people-subheading">{household.name}</h2>
                  <Button href={householdPath(household.id)} size="sm">
                    Open household
                  </Button>
                </div>
                {household.members.length === 0 ? (
                  <p className="muted">No members yet.</p>
                ) : (
                  <ul className="people-list" aria-label={`Members of ${household.name}`}>
                    {household.members.map(member => (
                      <li key={member.personId} className="people-member">
                        <span className="people-member-main">{`${member.givenName} ${member.familyName}`}</span>
                        <Pill tone="neutral">{householdRoleLabel(member)}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
