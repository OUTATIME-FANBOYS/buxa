import { notFound } from 'next/navigation';
import { can, CAMP_ROLE_LABELS, type Actor, type CampRole } from '@buxa/domain';
import { personEditPath } from '@/config/routes';
import { loadCampProfile } from '@buxa/server/composers/index.server';
import { loadHouseholdList, loadPersonMatches } from '@buxa/server/composers/index.server';
import { loadVisitHistory } from '@buxa/server/composers/index.server';
import { ArchivePersonButton } from '@/components/components/people/forms/export';
import { AttendanceHistory } from '@/components/components/people/export';
import { BadgePanel } from '@/components/components/people/export';
import { ContactDetails } from '@/components/components/people/export';
import { HouseholdPanel } from '@/components/components/people/export';
import { MembershipsPanel } from '@/components/components/people/export';
import { PersonHeader } from '@/components/components/people/export';
import { currentActor } from '@buxa/server/composers/index.server';
import { readListParams } from '@buxa/shared';
import { loadPerson } from '@buxa/server/composers/index.server';
import { Button } from '@/components/elements/export';

/**
 * One person. What is shown follows the role: contact details come back null for viewers (and are then left out), link and
 * membership and badge controls appear only where the role allows them. The server still decides every change.
 * `searchParams.q` is the name search for someone to link into a household (staff only; the service caps the matches).
 */
export async function PersonScreen({
  id,
  searchParams = {},
}: {
  id: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const person = await loadPerson(actor, id);
  if (!person) {
    notFound();
  }

  const { canUpdate, canCreate, canManage, canBadge, canArchive, canSeeVisits, canAuthorisePickup } =
    permissionsFor(actor);
  const { q } = readListParams(searchParams);
  // The camp's own zone (orgs.timezone) is what every time on this page is shown in. Every role may read the camp.
  const [visits, households, matches, camp] = await Promise.all([
    canSeeVisits ? loadVisitHistory(actor, person.id) : Promise.resolve([]),
    canUpdate ? loadHouseholdList(actor) : Promise.resolve([]),
    canUpdate && q !== '' ? loadPersonMatches(actor, q) : Promise.resolve([]),
    loadCampProfile(actor),
  ]);
  const roleLabel = person.roles.map((role: CampRole) => CAMP_ROLE_LABELS[role]).join(', ');
  const linkable = matches
    .filter(p => p.id !== person.id)
    .map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));

  return (
    <div className="page">
      <PersonHeader person={person} />
      <div className="grid-2">
        <section className="panel" aria-labelledby="details-heading">
          <h2 id="details-heading" className="people-heading">
            Details
          </h2>
          <ContactDetails person={person} />
          <div className="row">
            {canUpdate && (
              <Button size="sm" href={personEditPath(person.id)}>
                Edit details
              </Button>
            )}
            {canArchive && !person.archived && (
              <ArchivePersonButton personId={person.id} personName={`${person.givenName} ${person.familyName}`} />
            )}
          </div>
        </section>
        <HouseholdPanel
          personId={person.id}
          households={person.households}
          householdOptions={households.map(h => ({ id: h.id, name: h.name }))}
          canUpdate={canUpdate}
          canCreate={canCreate}
          canAuthorisePickup={canAuthorisePickup}
          query={q}
          linkable={linkable}
        />
        {person.memberships !== null && (
          <MembershipsPanel
            personId={person.id}
            memberships={person.memberships}
            canManage={canManage}
            timeZone={camp.timezone}
            clockFormat={camp.clockFormat}
          />
        )}
        {person.hasActiveBadge !== null && (
          <BadgePanel
            personId={person.id}
            personName={`${person.givenName} ${person.familyName}`}
            roleLabel={roleLabel}
            campName={camp.name}
            hasActiveBadge={person.hasActiveBadge}
            archived={person.archived}
            canManage={canBadge}
          />
        )}
      </div>
      {canSeeVisits && <AttendanceHistory entries={visits} timeZone={camp.timezone} clockFormat={camp.clockFormat} />}
    </div>
  );
}

/** The screen's controls, decided once from the role. Viewers get none of them. */
function permissionsFor(actor: Actor) {
  return {
    canUpdate: can(actor, 'people:update'),
    canCreate: can(actor, 'people:create'),
    canManage: can(actor, 'memberships:manage'),
    canBadge: can(actor, 'credentials:manage'),
    canArchive: can(actor, 'people:delete'),
    canSeeVisits: can(actor, 'attendance:record'),
    canAuthorisePickup: can(actor, 'people:authorise_pickup'),
  };
}
