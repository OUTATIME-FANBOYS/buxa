import { authorize, type Actor } from '@buxa/domain';
import type { Member } from '@buxa/contracts';
import { getRuntime } from '../../runtime';

/** One teacher the viewer may set the check-in option on, and whether it is on now. */
export interface TeacherCheckIn {
  userId: string;
  on: boolean;
}

/**
 * The check-in option for each teacher the actor may change (members:set_options, per target). Teachers the actor may not change
 * are left out, so the page shows a switch only where the server would accept the change.
 */
export async function loadTeacherOptions(actor: Actor, members: readonly Member[]): Promise<TeacherCheckIn[]> {
  const editable = members.filter(
    m =>
      m.role === 'teacher' &&
      authorize(actor, 'members:set_options', {
        orgId: actor.orgId,
        target: { userId: m.id, role: m.role },
        option: 'teacher.check_in_out',
      }).allow,
  );
  if (editable.length === 0) {
    return [];
  }
  const on = new Set(
    (await getRuntime().repositories.users.memberOptionsIn(actor.userId, actor.orgId))
      .filter(o => o.option === 'teacher.check_in_out')
      .map(o => o.userId),
  );

  return editable.map(m => ({ userId: m.id, on: on.has(m.id) }));
}
