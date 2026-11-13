import { useEffect, useState } from 'react';
import { Dialog, Field, useUi } from '@/components/ui';
import { useStore } from '../store';
import type { Column, ColumnKind, Project, Role } from '../types';
import { navigate } from '../lib/router';
import { serverApi } from '../lib/sync';

export function ProjectDialog({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { actions, workspace } = useStore(); const { toast } = useUi();
  const [name, setName] = useState(project?.name ?? ''); const [desc, setDesc] = useState(project?.description ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? ''); const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Give the project a name.');
    if (name.length > 60) return setErr('Keep the name under 60 characters.');
    if (project) { actions.updateProject(project.id, { name: name.trim(), description: desc.trim(), deadline: deadline || undefined }); toast('Project updated'); }
    else if (workspace) { const id = actions.createProject(workspace.id, name.trim(), desc.trim(), deadline || undefined); navigate('/board/' + id); toast('Project created'); }
    onClose();
  };
  return (
    <Dialog title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Brand refresh" /></Field>
        <Field label="Description"><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} maxLength={300} placeholder="What is this project for?" /></Field>
        <Field label="Deadline"><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">{project ? 'Save' : 'Create project'}</button></div>
      </form>
    </Dialog>
  );
}

export function WorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { actions } = useStore(); const [name, setName] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="New workspace" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => { e.preventDefault(); if (!name.trim()) return setErr('Give the workspace a name.'); actions.createWorkspace(name.trim()); navigate('/projects'); onClose(); }}>
        <Field label="Name" error={err} hint="Workspaces group projects and the people who work on them."><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus /></Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create workspace</button></div>
      </form>
    </Dialog>
  );
}

export function ColumnDialog({ projectId, column, onClose }: { projectId: string; column?: Column; onClose: () => void }) {
  const { actions } = useStore();
  const [name, setName] = useState(column?.name ?? ''); const [kind, setKind] = useState<ColumnKind>(column?.kind ?? 'active'); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title={column ? 'Edit column' : 'New column'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return setErr('Name the column.');
        if (name.length > 30) return setErr('Keep it under 30 characters.');
        column ? actions.updateColumn(projectId, column.id, { name: name.trim(), kind }) : actions.createColumn(projectId, name.trim(), kind);
        onClose();
      }}>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Blocked" /></Field>
        <Field label="Counts as" hint="Used by the dashboard and reports to measure progress.">
          <select value={kind} onChange={e => setKind(e.target.value as ColumnKind)}>
            <option value="open">Not started</option><option value="active">In progress</option><option value="done">Done</option>
          </select>
        </Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">{column ? 'Save' : 'Add column'}</button></div>
      </form>
    </Dialog>
  );
}

export function InviteDialog({ onClose }: { onClose: () => void }) {
  const { actions, workspace } = useStore(); const { toast } = useUi();
  const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('member'); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="Invite to workspace" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address.');
        const m = actions.invite(workspace!.id, email, role);
        if (m) return setErr(m);
        toast(`Invitation added for ${email.trim()}`); onClose();
      }}>
        <Field label="Email" error={err}><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(null); }} data-autofocus placeholder="name@company.com" /></Field>
        <Field label="Role" hint="Viewers can read everything but cannot edit.">
          <select value={role} onChange={e => setRole(e.target.value as Role)}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select>
        </Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Send invite</button></div>
      </form>
    </Dialog>
  );
}

export function AgentDialog({ onClose }: { onClose: () => void }) {
  const { actions, workspace, projects } = useStore(); const { toast } = useUi();
  const [name, setName] = useState(''); const [model, setModel] = useState('Claude'); const [purpose, setPurpose] = useState('');
  const [scope, setScope] = useState<string[]>(projects.map(p => p.id)); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="Add an agent" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return setErr('Give the agent a name.');
        if (!workspace) return;
        actions.addAgent(workspace.id, name.trim(), model.trim() || 'Claude', purpose.trim(), scope); toast(`${name.trim()} added. It starts by asking before it changes anything.`); onClose();
      }}>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Release notes agent" maxLength={40} /></Field>
        <Field label="Model or tool" hint="Shown next to its name. It is a label for people; it does not connect anything yet."><input value={model} onChange={e => setModel(e.target.value)} maxLength={40} /></Field>
        <Field label="What is it for?"><textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={200} placeholder="One sentence people will see when reviewing its work." /></Field>
        <fieldset className="field"><legend className="field-label">Projects it may touch</legend>
          {projects.map(p => <label key={p.id} className="check-row"><input type="checkbox" checked={scope.includes(p.id)} onChange={() => setScope(x => (x.includes(p.id) ? x.filter(i => i !== p.id) : [...x, p.id]))} /><span>{p.name}</span></label>)}
        </fieldset>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Add agent</button></div>
      </form>
    </Dialog>
  );
}

/** Creates (or replaces) the token an agent uses to connect, and shows how to hand it to Claude. The token is shown once. */
export function ConnectAgentDialog({ agentId, name, onClose }: { agentId: string; name: string; onClose: () => void }) {
  const { serverInfo } = useStore(); const { toast, confirm } = useUi();
  const [info, setInfo] = useState<{ exists: boolean; createdAt: string | null; lastSeen: string | null } | null>(null);
  const [token, setToken] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { serverApi.tokenInfo(agentId).then(setInfo).catch(() => setErr('Could not reach the Buxa server.')); }, [agentId]);
  const url = serverInfo.mcpUrl ?? `${location.origin}/mcp`;
  const cli = token ? `claude mcp add --transport http buxa ${url} --header "Authorization: Bearer ${token}"` : '';
  const cfg = token ? JSON.stringify({ mcpServers: { buxa: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2) : '';
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Copy failed. Select the text and copy it by hand.', { tone: 'error' }); } };
  const issue = async () => {
    if (info?.exists && !await confirm({ title: 'Replace the token?', body: `The current token for ${name} stops working straight away. Anything still using it will be disconnected.`, confirmLabel: 'Replace token', danger: true })) return;
    setBusy(true); setErr(null);
    try { const r = await serverApi.issueToken(agentId); setToken(r.token); setInfo(await serverApi.tokenInfo(agentId)); } catch { setErr('Could not create a token.'); }
    setBusy(false);
  };
  const revoke = async () => {
    if (!await confirm({ title: 'Disconnect this agent?', body: 'Its token stops working. You can create a new one at any time.', confirmLabel: 'Disconnect', danger: true })) return;
    await serverApi.revokeToken(agentId); setToken(null); setInfo(await serverApi.tokenInfo(agentId)); toast('Disconnected');
  };
  return (
    <Dialog title={`Connect ${name}`} onClose={onClose} wide>
      <div className="stack">
        <p className="muted">Give Claude (or any MCP client) this agent’s token. It can then read the projects you allowed and propose changes, always within the permissions you set here.</p>
        {err && <p className="field-error" role="alert">{err}</p>}
        {info && !token && <p className="small"><strong>{info.exists ? 'A token exists' : 'Not connected yet'}</strong>{info.exists && <span className="muted"> · created {new Date(info.createdAt!).toLocaleDateString()}{info.lastSeen ? ` · last used ${new Date(info.lastSeen).toLocaleString()}` : ' · never used'}</span>}</p>}
        {token && (<>
          <p className="notice-box" role="status">Copy this now. It is shown once, and anyone who holds it can act as {name}. Treat it like a password.</p>
          <Field label="Claude Code (run in a terminal)"><div className="copy-box"><code>{cli}</code><button type="button" className="btn btn-sm" onClick={() => copy(cli, 'Command')}>Copy</button></div></Field>
          <Field label="Other MCP clients (JSON config)"><div className="copy-box"><pre>{cfg}</pre><button type="button" className="btn btn-sm" onClick={() => copy(cfg, 'Config')}>Copy</button></div></Field>
          <p className="muted small">The server only listens on this computer ({url}).</p>
        </>)}
        <div className="row-end">
          {info?.exists && !token && <button className="btn btn-danger-ghost" onClick={revoke}>Disconnect</button>}
          <button className="btn" onClick={onClose}>{token ? 'Done' : 'Close'}</button>
          {!token && <button className="btn btn-primary" onClick={issue} disabled={busy || !info}>{info?.exists ? 'Replace token' : 'Create token'}</button>}
        </div>
      </div>
    </Dialog>
  );
}
