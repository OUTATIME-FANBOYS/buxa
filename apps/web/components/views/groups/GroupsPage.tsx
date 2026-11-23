import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { Empty, PageHeader } from '@/components/components';
import { GroupDialog, GroupsTable, RoomDialog, RoomsTable } from '@/components/components/groups';
import { currentActor, loadSessionGroups } from '@buxa/server/composers/index.server';
import { SessionNav } from './SessionNav';

/**
 * A session's groups and rooms. Everyone who can read the camp sees the lists; staff and above (classes:manage) also see the New
 * and Edit buttons. A group's capacity and staff ratio, and a room's location and capacity, are set here. Changes are audited.
 */
export async function GroupsPage({ sessionId }: { sessionId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadSessionGroups(actor, sessionId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot see this session" body="Ask an admin if you need access." />
      </div>
    );
  }

  const { session, groups, rooms } = loaded.value;
  const canManage = can(actor, 'classes:manage');
  const dates = session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet';

  return (
    <div className="page">
      <SessionNav sessionId={session.id} sessionName={session.name} current="groups" />
      <PageHeader
        title="Groups and rooms"
        subtitle={`${session.name}, ${dates}`}
        actions={
          canManage && (
            <>
              <RoomDialog sessionId={session.id} />
              <GroupDialog sessionId={session.id} />
            </>
          )
        }
      />

      <section aria-labelledby="groups-heading" className="stack">
        <h2 id="groups-heading" className="people-subheading">
          Groups
        </h2>
        <p className="muted">A group holds campers for the session. Its staff ratio is campers per staff member.</p>
        <GroupsTable sessionId={session.id} groups={groups} canManage={canManage} />
      </section>

      <section aria-labelledby="rooms-heading" className="stack">
        <h2 id="rooms-heading" className="people-subheading">
          Rooms
        </h2>
        <p className="muted">
          A room is booked for this session. Two sessions that share a day cannot use the same room.
        </p>
        <RoomsTable sessionId={session.id} rooms={rooms} canManage={canManage} />
      </section>
    </div>
  );
}
