import type { Member } from '@buxa/contracts';
import { Avatar, Pill } from '@/components/ui';
import { ROLE_LABEL } from '../lib/abilities';

export function MembersTable({ members }: { members: readonly Member[] }) {
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
      <tbody>
        {members.map(m => (
          <tr key={m.id}>
            <td><span className="row"><Avatar user={{ name: m.name }} size={26} /> {m.name}</span></td>
            <td>{m.email}</td>
            <td><Pill tone={m.role === 'owner' ? 'brand' : 'neutral'} dot={false}>{ROLE_LABEL[m.role]}</Pill></td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
