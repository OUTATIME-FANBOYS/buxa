import type { Member } from '@buxa/contracts';
import { Avatar } from '@/components/elements';
import { Pill } from '@/components/elements';
import { ROLE_LABEL, ROLE_TONE } from '@buxa/shared';
import { firstNameOf } from '@buxa/shared/names';
import { CheckInToggle } from './CheckInToggle';

/**
 * Email is shown only where the reader may see it (admins and above); everyone else sees names and roles.
 * `teacherOptions` is given only to a reader who may change a teacher's options: it lists those teachers and whether check-in is on.
 * Teachers not in the list, and every other role, get no switch.
 */
export function MembersTable({
  members,
  showEmail,
  teacherOptions,
}: {
  members: readonly Member[];
  showEmail: boolean;
  teacherOptions?: readonly { userId: string; on: boolean }[];
}) {
  const withCheckIn = teacherOptions !== undefined && teacherOptions.length > 0;
  const checkIn = new Map((teacherOptions ?? []).map(t => [t.userId, t.on]));

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            {showEmail && <th>Email</th>}
            <th>Role</th>
            {withCheckIn && <th>Check-in and check-out</th>}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td>
                <span className="row">
                  <Avatar user={{ name: m.name }} size={26} /> {firstNameOf(m.name)}
                </span>
              </td>
              {showEmail && <td>{m.email}</td>}
              <td>
                <Pill tone={ROLE_TONE[m.role]} dot={false}>
                  {ROLE_LABEL[m.role]}
                </Pill>
              </td>
              {withCheckIn && (
                <td>
                  {checkIn.has(m.id) && (
                    <CheckInToggle userId={m.id} firstName={firstNameOf(m.name)} on={checkIn.get(m.id) ?? false} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
