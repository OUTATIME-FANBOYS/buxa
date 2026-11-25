import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROUTES } from '@buxa/shared/config/routes';
import { displayName } from '@buxa/shared';
import { can, CAMP_ROLE_LABELS, type Actor, type CampRole } from '@buxa/domain';
import { campClock, loadCampProfile } from '@buxa/server/composers/index.server';
import { loadHouseholdList, loadPersonMatches } from '@buxa/server/composers/index.server';
import { loadVisitHistory, loadSessions } from '@buxa/server/composers/index.server';
import { ArchivePersonButton, EditPersonButton } from '@/components/components/people/forms';
import { AttendanceHistory } from '@/components/components/people';
import { PersonAvatar } from '@/components/elements/PersonAvatar';
import { BadgePanel } from '@/components/components/people';
import { EmergencyContactPanel } from '@/components/components/people';
import { HouseholdPanel } from '@/components/components/people';
import { isFamilyRole } from '@/components/components/people/forms/roleGroups';
import { MembershipsPanel } from '@/components/components/people';
import { PersonHeader } from '@/components/components/people';
import { currentActor } from '@buxa/server/composers/index.server';
import { readListParams, toHouseholdChoices } from '@buxa/shared';
import { loadPerson } from '@buxa/server/composers/index.server';

/**
 * One person. What is shown follows the role: contact details come back null for viewers (and are then left out), link and
 * membership and badge controls appear only where the role allows them. The server still decides every change.
 * `searchParams.q` is the name search for someone to link into a household (staff only; the service caps the matches).
 * `editOpen` opens the Edit person pop-up on arrival (the /edit address).
 */
export async function PersonScreen({
  id,
  searchParams = {},
  editOpen = false,
}: {
  id: string;
  searchParams?: Record<string, string | string[] | undefined>;
  editOpen?: boolean;
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
  const [visits, households, matches, camp, clock, sessions] = await Promise.all([
    canSeeVisits ? loadVisitHistory(actor, person.id) : Promise.resolve([]),
    canUpdate ? loadHouseholdList(actor) : Promise.resolve([]),
    canUpdate && q !== '' ? loadPersonMatches(actor, q) : Promise.resolve([]),
    loadCampProfile(actor),
    campClock(actor),
    // The camp's sessions for the Add membership pop-up. A viewer, or anyone who may not read sessions, gets none.
    canManage ? loadSessions(actor) : Promise.resolve({ ok: true as const, value: [] }),
  ]);
  const roleLabel = person.roles.map((role: CampRole) => CAMP_ROLE_LABELS[role]).join(', ');
  const linkable = matches
    .filter(p => p.id !== person.id)
    .map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={ROUTES.people}>
          People
        </Link>{' '}
        / {displayName(person)}
      </nav>
      <PersonHeader
        person={person}
        actions={
          <>
            {canUpdate && (
              <EditPersonButton
                personId={person.id}
                households={toHouseholdChoices(households)}
                label="Edit details"
                variant="primary"
                initiallyOpen={editOpen}
              />
            )}
            {canArchive && !person.archived && (
              <ArchivePersonButton personId={person.id} personName={`${person.givenName} ${person.familyName}`} />
            )}
          </>
        }
      />
      <div className="person-tiles">
        <section className="panel" aria-labelledby="profile-picture-title">
          <h2 id="profile-picture-title" className="people-heading">
            Profile picture
          </h2>
          <div className="buxa:flex buxa:items-center buxa:gap-[16px]">
            <PersonAvatar size={96} />
            <p className="muted">No picture yet. Photo uploads come in a later phase.</p>
          </div>
        </section>
        {person.memberships !== null && (
          <MembershipsPanel
            personId={person.id}
            memberships={person.memberships}
            canManage={canManage}
            sessions={sessions.ok ? sessions.value : []}
            timeZone={camp.timezone}
            clockFormat={clock.clockFormat}
          />
        )}
        {person.roles.some(isFamilyRole) ? (
          <HouseholdPanel
            personId={person.id}
            households={person.households}
            householdOptions={households.map(h => ({ id: h.id, name: h.name }))}
            canUpdate={canUpdate}
            canCreate={canCreate}
            canAuthorisePickup={canAuthorisePickup}
            query={q}
            linkable={linkable}
          >
            <EmergencyContactPanel person={person} embedded />
          </HouseholdPanel>
        ) : (
          <EmergencyContactPanel person={person} />
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
        {canSeeVisits && (
          <AttendanceHistory entries={visits} timeZone={camp.timezone} clockFormat={clock.clockFormat} />
        )}
      </div>
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
