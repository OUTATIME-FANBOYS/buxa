import type { Member } from '@buxa/contracts';
import { Avatar } from '@/elements/export';
import { Pill } from '@/elements/export';
import { ROLE_LABEL } from '@/logic/common';

/** Email is shown only where the reader may see it (admins and above); everyone else sees names and roles. */
export function MembersTable({ members, showEmail }: { members: readonly Member[]; showEmail: boolean }) {
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Name</th>{showEmail && <th>Email</th>}<th>Role</th></tr></thead>
      <tbody>
        {members.map(m => (
          <tr key={m.id}>
            <td><span className="row"><Avatar user={{ name: m.name }} size={26} /> {m.name}</span></td>
            {showEmail && <td>{m.email}</td>}
            <td><Pill tone={m.role === 'owner' ? 'brand' : 'neutral'} dot={false}>{ROLE_LABEL[m.role]}</Pill></td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
