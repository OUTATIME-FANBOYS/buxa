import { notFound } from 'next/navigation';
import { can, CAMP_ROLE_LABELS, type Actor, type CampRole } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { ArchivePersonButton } from '../forms/ArchivePersonButton';
import { AttendanceHistory } from '../components/AttendanceHistory';
import { BadgePanel } from '../components/BadgePanel';
import { ContactDetails } from '../components/ContactDetails';
import { HouseholdPanel } from '../components/HouseholdPanel';
import { MembershipsPanel } from '../components/MembershipsPanel';
import { PersonHeader } from '../components/PersonHeader';
import { currentActor } from '../lib/camp';
import { loadPerson } from '../lib/loadPerson';

/**
 * One person. What is shown follows the role: contact details come back null for viewers (and are then left out), link and
 * membership and badge controls appear only where the role allows them. The server still decides every change.
 */
export async function PersonScreen({ id }: { id: string }) {
  const actor = await currentActor();
  if (!actor) notFound();
  const person = await loadPerson(actor, id);
  if (!person) notFound();

  const { canUpdate, canCreate, canManage, canBadge, canArchive, canSeeVisits } = permissionsFor(actor);
  const services = getRuntime().services;
  // The camp's own zone (orgs.timezone) is what every time on this page is shown in. Every role may read the camp.
  const [visits, others, camp] = await Promise.all([
    canSeeVisits ? services.attendance.history(actor, person.id) : Promise.resolve([]),
    canUpdate ? services.people.list(actor) : Promise.resolve([]),
    services.orgs.getCamp(actor),
  ]);
  const roleLabel = person.roles.map((role: CampRole) => CAMP_ROLE_LABELS[role]).join(', ');
  const linkable = others.filter(p => p.id !== person.id).map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));

  return (
    <div className="page">
      <PersonHeader person={person} />
      <div className="grid-2">
        <section className="panel" aria-labelledby="details-heading">
          <h2 id="details-heading" className="people-heading">Details</h2>
          <ContactDetails person={person} />
          {canArchive && !person.archived && <ArchivePersonButton personId={person.id} personName={`${person.givenName} ${person.familyName}`} />}
        </section>
        <HouseholdPanel households={person.households} canUpdate={canUpdate} canCreate={canCreate} linkable={linkable} />
        <MembershipsPanel personId={person.id} memberships={person.memberships} canManage={canManage} />
        <BadgePanel personId={person.id} personName={`${person.givenName} ${person.familyName}`} roleLabel={roleLabel}
          campName={camp.name} hasActiveBadge={person.hasActiveBadge} archived={person.archived} canManage={canBadge} />
      </div>
      {canSeeVisits && <AttendanceHistory entries={visits} timeZone={camp.timezone} />}
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
  };
}
