import type { Member } from '@buxa/contracts';
import { Avatar } from '@/components/elements';
import { Pill } from '@/components/elements';
import { ROLE_LABEL, ROLE_TONE, expiryDay, expiryState, fmt } from '@buxa/shared';
import { firstNameOf } from '@buxa/shared/names';
import { CheckInToggle } from './CheckInToggle';

/**
 * Team access that has ended shows "Expired"; access ending within 14 days shows its date. A later end, or none, shows nothing.
 * The server already refuses an expired member; this pill only tells the reader why.
 */
function AccessEnds({ expiresAt, now }: { expiresAt: string | null; now: Date }) {
  if (!expiresAt) {
    return null;
  }
  const state = expiryState(expiresAt, now);
  if (state === 'expired') {
    return (
      <Pill tone="crit" dot={false}>
        Expired
      </Pill>
    );
  }
  if (state === 'soon') {
    return (
      <Pill tone="warn" dot={false}>
        {`Expires ${fmt(expiryDay(expiresAt), true)}`}
      </Pill>
    );
  }

  return null;
}

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
  const now = new Date();

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
                <AccessEnds expiresAt={m.expiresAt} now={now} />
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
