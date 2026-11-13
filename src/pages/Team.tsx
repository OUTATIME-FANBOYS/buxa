import { useState } from 'react';
import { useStore } from '../store';
import { Avatar, Empty, Menu, Pill, useUi } from '../components/ui';
import { Icon } from '../components/Icon';
import { InviteDialog } from '../components/dialogs';
import type { Role } from '../types';

const ROLES: { v: Role; l: string; d: string }[] = [
  { v: 'owner', l: 'Owner', d: 'Full control, including billing and deletion' }, { v: 'admin', l: 'Admin', d: 'Manage projects and people' },
  { v: 'member', l: 'Member', d: 'Create and edit tasks' }, { v: 'viewer', l: 'Viewer', d: 'Read only' }];

export function Team() {
  const { s, actions, members, workspace, wsTasks, kindOf, me, myRole } = useStore(); const { confirm, toast } = useUi();
  const [inv, setInv] = useState(false);
  const canManage = myRole === 'owner' || myRole === 'admin';
  if (!workspace) return <Empty title="No workspace" />;
  return (
    <div className="page">
      <header className="page-head"><div className="page-title"><h1>Team</h1><p className="muted">{workspace.name} · {members.length} member{members.length === 1 ? '' : 's'}</p></div>
        {canManage && <div className="page-actions"><button className="btn btn-primary" onClick={() => setInv(true)}><Icon name="plus" size={16} />Invite</button></div>}</header>
      <div className="table-wrap"><table className="table team-table">
        <thead><tr><th><span>Member</span></th><th className="c-open"><span>Open tasks</span></th><th className="c-done"><span>Completed</span></th><th><span>Role</span></th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{members.filter(m => s.ui.agentsEnabled || !m.user.agent).map(m => {
          const mine = wsTasks.filter(t => t.assigneeId === m.userId && !t.archived); const open = mine.filter(t => kindOf(t) !== 'done').length;
          const locked = m.role === 'owner' || m.userId === me?.id || !!m.user.agent;
          return (
            <tr key={m.userId}>
              <td><span className="who"><Avatar user={m.user} size={32} /><span><strong>{m.user.name}</strong>{m.userId === me?.id && <span className="tag">You</span>}{m.user.agent && <span className="tag tag-agent">Agent</span>}{m.user.pending && <span className="tag">Invited</span>}<span className="muted small block">{m.user.title ?? m.user.email}</span></span></span></td>
              <td className="c-open">{open}</td><td className="c-done">{mine.length - open}</td>
              <td>{canManage && !locked ? (
                <select aria-label={`Role for ${m.user.name}`} value={m.role} onChange={e => { actions.setRole(workspace.id, m.userId, e.target.value as Role); toast(`${m.user.name} is now ${e.target.value}`); }}>
                  {ROLES.filter(r => r.v !== 'owner').map(r => <option key={r.v} value={r.v}>{r.l}</option>)}</select>) : <Pill tone={m.role === 'owner' ? 'brand' : 'neutral'} dot={false}>{ROLES.find(r => r.v === m.role)!.l}</Pill>}</td>
              <td className="c-act">{canManage && !locked && <Menu label={`Actions for ${m.user.name}`} trigger={<Icon name="more" />} items={[{ label: 'Remove from workspace', icon: 'trash', danger: true, onSelect: async () => { if (await confirm({ title: `Remove ${m.user.name}?`, body: 'Their tasks become unassigned.', confirmLabel: 'Remove', danger: true })) actions.removeMember(workspace.id, m.userId); } }]} />}</td>
            </tr>);
        })}</tbody></table></div>
      <section className="panel roles"><h2>Roles</h2><dl>{ROLES.map(r => <div key={r.v}><dt>{r.l}</dt><dd className="muted">{r.d}</dd></div>)}</dl></section>
      {inv && <InviteDialog onClose={() => setInv(false)} />}
    </div>
  );
}
