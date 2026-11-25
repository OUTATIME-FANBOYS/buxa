import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { Empty, PageHeader } from '@/components/components';
import { AssignBoard } from '@/components/components/groups';
import { currentActor, loadSessionGroups } from '@buxa/server/composers/index.server';
import { SessionNav } from './SessionNav';

/**
 * A session's assign page: each group with the people in it and their room, and the campers not placed yet. Staff and above see the
 * Place button in the campers not placed yet card; a viewer sees the board only. Every rule (capacity, age, ratio, room use) runs on the server when a person is
 * placed, and a refusal is shown under the form.
 */
export async function AssignPage({ sessionId }: { sessionId: string }) {
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

  const { session, groups, rooms, assignments, campers, staff } = loaded.value;
  const canManage = can(actor, 'classes:manage');
  const placed = new Set(assignments.map(a => a.personId));
  const unplaced = campers.filter(c => !placed.has(c.id));
  const needsGroupsAndRooms = groups.length === 0 || rooms.length === 0;
  const choices = { sessionId: session.id, campers, staff, groups, rooms };

  return (
    <div className="page">
      <SessionNav sessionId={session.id} sessionName={session.name} current="assign" />
      <PageHeader title="Assign people" subtitle={`${session.name}. Each camper has one place in this session.`} />
      {!canManage && <p className="muted">Only staff can place or move people.</p>}
      {needsGroupsAndRooms && canManage && (
        <p className="muted">Create at least one group and one room on the Groups and rooms page first.</p>
      )}
      <AssignBoard
        sessionId={session.id}
        canManage={canManage}
        groups={groups}
        rooms={rooms}
        assignments={assignments}
        unplaced={unplaced}
        choices={canManage ? choices : undefined}
      />
    </div>
  );
}
