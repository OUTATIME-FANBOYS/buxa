import { useState } from 'react';
import { Dialog, Field, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import type { Role } from '../../types';

export function InviteDialog({ onClose }: { onClose: () => void }) {
  const { actions, workspace } = useStore(); const { toast } = useUi();
  const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('member'); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="Invite to workspace" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address.');
        if (!workspace) return;
        const m = actions.invite(workspace.id, email, role);
        if (m) return setErr(m);
        toast(`Invitation added for ${email.trim()}`); onClose();
      }}>
        <Field label="Email" error={err}><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(null); }} data-autofocus placeholder="name@example.com" /></Field>
        <Field label="Role" hint="Viewers can read everything but cannot edit.">
          <select value={role} onChange={e => setRole(e.target.value as Role)}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select>
        </Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Send invite</button></div>
      </form>
    </Dialog>
  );
}
