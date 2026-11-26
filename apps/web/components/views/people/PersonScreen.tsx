import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROUTES } from '@buxa/shared/config/routes';
import { displayName } from '@buxa/shared';
import { can, CAMP_ROLE_LABELS, type Actor, type CampRole } from '@buxa/domain';
import { campClock, loadCampProfile } from '@buxa/server/composers/index.server';
import { loadHouseholdList } from '@buxa/server/composers/index.server';
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
import { toHouseholdChoices } from '@buxa/shared';
import { loadPerson } from '@buxa/server/composers/index.server';

/**
 * One person. What is shown follows the role: contact details come back null for viewers (and are then left out), link and
 * membership and badge controls appear only where the role allows them. The server still decides every change.
 * The household card only links to each household's page; the edits to a household are made there.
 * `editOpen` opens the Edit person pop-up on arrival (the /edit address).
 */
export async function PersonScreen({ id, editOpen = false }: { id: string; editOpen?: boolean }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const person = await loadPerson(actor, id);
  if (!person) {
    notFound();
  }

  const { canUpdate, canManage, canBadge, canArchive, canSeeVisits } = permissionsFor(actor);
  // The camp's own zone (orgs.timezone) is what every time on this page is shown in. Every role may read the camp.
  const [visits, households, camp, clock, sessions] = await Promise.all([
    canSeeVisits ? loadVisitHistory(actor, person.id) : Promise.resolve([]),
    // The household choices for the Edit person pop-up only; the household card itself is links.
    canUpdate ? loadHouseholdList(actor) : Promise.resolve([]),
    loadCampProfile(actor),
    campClock(actor),
    // The camp's sessions for the Add membership pop-up. A viewer, or anyone who may not read sessions, gets none.
    canManage ? loadSessions(actor) : Promise.resolve({ ok: true as const, value: [] }),
  ]);
  const roleLabel = person.roles.map((role: CampRole) => CAMP_ROLE_LABELS[role]).join(', ');

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
        {person.roles.some(isFamilyRole) && <HouseholdPanel personId={person.id} households={person.households} />}
        {person.roles.includes('camper') && <EmergencyContactPanel person={person} />}
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
    canManage: can(actor, 'memberships:manage'),
    canBadge: can(actor, 'credentials:manage'),
    canArchive: can(actor, 'people:delete'),
    canSeeVisits: can(actor, 'attendance:record'),
  };
}
