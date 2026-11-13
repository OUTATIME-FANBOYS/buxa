'use client';

import { Avatar, Pill } from '@/features/kanban/components/ui';
import { useLoad } from '../hooks/useLoad';
import { ROLE_LABEL } from '../lib/abilities';
import { useCamp } from '../state/CampProvider';
import { useCurrentCamp } from '../state/CurrentCamp';
import { Loading, Problem } from './Status';

export function Members() {
  const { api } = useCamp();
  const camp = useCurrentCamp();
  const result = useLoad(() => api.members(camp.orgId), [api, camp.orgId]);
  if (result.status === 'loading') return <Loading what="members" />;
  if (result.status === 'error') return <Problem error={result.error} retry={result.retry} />;
  const { members } = result.data;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <h1>Members</h1>
          <p className="muted">{members.length} {members.length === 1 ? 'person has' : 'people have'} access to this camp. Inviting people is not available yet.</p>
        </div>
      </header>
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
    </div>
  );
}
