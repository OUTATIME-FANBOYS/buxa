import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { can } from '@buxa/domain';
import { Avatar, Dialog, Empty, Field, Menu, Pill, UiProvider, useUi } from '../components/ui';
import { Icon } from '../components/Icon';
import { ApiError, type Member, type Org } from './api';
import { AuthProvider, useAuth } from './auth';
import { CampProvider, useCamp } from './camp';
import { SLUG_RULE, ROLE_LABEL, abilitiesFor, isDark, parseCampHash, setTheme, suggestSlug } from './lib';
import { supabase } from './supabase';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const go = (to: string) => { location.hash = to; };

/* ---------- Not configured ---------- */
function NotConfigured() {
  return (
    <main className="auth"><div className="auth-card">
      <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
      <h1>Connect Supabase</h1>
      <p className="muted">This app needs two public settings before people can sign in.</p>
      <ol className="steps">
        <li>Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code>.</li>
        <li>Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from Supabase → Project Settings → API.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
      <p className="muted small">Only the publishable key belongs here. Never add a secret or service_role key to the web app.</p>
      <a className="btn btn-block" href="#/dashboard">Open the staff board without signing in</a>
    </div></main>
  );
}

/* ---------- Sign in / create account ---------- */
function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [note, setNote] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (mode === 'up' && !name.trim()) er.name = 'Tell us what to call you.';
    if (!EMAIL.test(email.trim())) er.email = 'Enter a valid email address.';
    if (pw.length < (mode === 'up' ? 8 : 1)) er.pw = mode === 'up' ? 'Use at least 8 characters.' : 'Enter your password.';
    setErrs(er); setNote(''); if (Object.keys(er).length) return;
    setBusy(true);
    if (mode === 'in') { const m = await signIn(email, pw); if (m) setErrs({ form: m }); }
    else { const r = await signUp(name, email, pw); if (r.error) setErrs({ form: r.error }); else if (r.needsConfirm) setNote('Check your email for a confirmation link, then sign in.'); }
    setBusy(false);
  };

  return (
    <main className="auth">
      <aside className="auth-hero" aria-hidden="true">
        <div className="brand brand-lg"><span className="logo"><Icon name="kanban" size={18} /></span> Buxa</div>
        <div className="hero-copy">
          <p className="hero-title">Run your camp from one place.</p>
          <ul>
            <li><Icon name="users" size={16} />People, families and staff in one list</li>
            <li><Icon name="calendar" size={16} />Sessions, registration and check-in</li>
            <li><Icon name="kanban" size={16} />A task board for the team behind the scenes</li>
          </ul>
        </div>
      </aside>
      <div className="auth-card">
        <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
        <h1>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{mode === 'in' ? 'Sign in to manage your camp.' : 'Then set up your first camp.'}</p>
        <form onSubmit={submit} noValidate>
          {mode === 'up' && <Field label="Name" error={errs.name}><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" autoFocus /></Field>}
          <Field label="Email" error={errs.email}><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus={mode === 'in'} /></Field>
          <Field label="Password" error={errs.pw}><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
          {errs.form && <p className="field-error" role="alert">{errs.form}</p>}
          {note && <p className="muted" role="status">{note}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch muted">
          {mode === 'in' ? 'New here?' : 'Already have an account?'}{' '}
          <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErrs({}); setNote(''); }}>{mode === 'in' ? 'Create an account' : 'Sign in'}</button>
        </p>
        <p className="muted small">Looking for the demo task board? <a href="#/dashboard">Open it here</a>.</p>
      </div>
    </main>
  );
}

/* ---------- Create a camp ---------- */
function NewCamp({ first }: { first: boolean }) {
  const { api, reload, selectOrg } = useCamp();
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [touched, setTouched] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const onName = (v: string) => { setName(v); if (!touched) setSlug(suggestSlug(v)); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = 'Give your camp a name.';
    if (!SLUG_RULE.test(slug)) er.slug = 'Use 3–50 lowercase letters, numbers or dashes.';
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true);
    try { const o = await api.createOrg(name.trim(), slug); selectOrg(o.id); await reload(); go('/camp'); }
    catch (x) { setErrs(x instanceof ApiError && x.status === 409 ? { slug: 'That address is taken. Try another.' } : { form: x instanceof ApiError ? x.message : 'Could not create the camp.' }); }
    finally { setBusy(false); }
  };
  return (
    <div className={first ? 'setup' : 'page narrow'}>
      <div className="panel">
        <div className="page-title"><h1>{first ? 'Set up your camp' : 'New camp'}</h1><p className="muted">{first ? 'You will be its owner. You can add people after this.' : 'You will be the owner of the new camp.'}</p></div>
        <form onSubmit={submit} noValidate className="stack">
          <Field label="Camp name" error={errs.name}><input value={name} onChange={e => onName(e.target.value)} autoFocus maxLength={120} /></Field>
          <Field label="Address" error={errs.slug} hint="Used in links to your camp. Lowercase letters, numbers and dashes.">
            <input value={slug} onChange={e => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} maxLength={50} /></Field>
          {errs.form && <p className="field-error" role="alert">{errs.form}</p>}
          <div className="row"><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create camp'}</button>
            {!first && <a className="btn" href="#/camp">Cancel</a>}</div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Data hook ---------- */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [st, setSt] = useState<{ status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; data: T }>({ status: 'loading' });
  const run = useCallback(() => {
    setSt({ status: 'loading' });
    load().then(data => setSt({ status: 'ready', data }), error => setSt({ status: 'error', error: error instanceof ApiError ? error : new ApiError(0, 'network', 'Something went wrong.') }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...st, retry: run };
}
function Loading({ what }: { what: string }) { return <div className="page" aria-busy="true" role="status"><p className="muted">Loading {what}…</p></div>; }
function Problem({ error, retry }: { error: ApiError; retry: () => void }) {
  return <div className="page"><Empty icon="alert" title={error.status === 403 ? 'No access' : 'Could not load this'} body={error.message}
    action={<button className="btn" onClick={retry}>Try again</button>} /></div>;
}

/* ---------- Overview ---------- */
function RenameDialog({ org, orgId, onClose, onDone }: { org: Org; orgId: string; onClose: () => void; onDone: () => void }) {
  const { api, reload } = useCamp(); const { toast } = useUi();
  const [name, setName] = useState(org.name); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!name.trim()) { setErr('Give your camp a name.'); return; }
    setBusy(true);
    try { await api.renameOrg(orgId, name.trim()); await reload(); toast('Camp renamed'); onDone(); onClose(); }
    catch (x) { setErr(x instanceof ApiError ? x.message : 'Could not rename the camp.'); setBusy(false); }
  };
  return (
    <Dialog title="Rename camp" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="rename" disabled={busy}>Save</button></>}>
      <form id="rename" onSubmit={save} noValidate><Field label="Camp name" error={err}><input value={name} onChange={e => setName(e.target.value)} maxLength={120} data-autofocus autoFocus /></Field></form>
    </Dialog>
  );
}

function Overview() {
  const { api, current } = useCamp(); const me = useCampMe();
  const [renaming, setRenaming] = useState(false);
  const orgId = current!.orgId;
  const org = useLoad(() => api.org(orgId), [api, orgId]);
  const members = useLoad(() => api.members(orgId), [api, orgId]);
  if (org.status === 'loading') return <Loading what="your camp" />;
  if (org.status === 'error') return <Problem error={org.error} retry={org.retry} />;
  const actor = { userId: me.id, orgId, role: current!.role };
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title"><h1>{org.data.name}</h1><p className="muted">/{org.data.slug}</p></div>
        <div className="page-actions">{can(actor, 'org:update') && <button className="btn" onClick={() => setRenaming(true)}>Rename</button>}</div>
      </header>
      <section className="grid-3" aria-label="At a glance">
        <div className="stat"><div className="stat-top"><span className="stat-label">Members</span></div><span className="stat-num">{members.status === 'ready' ? members.data.members.length : '–'}</span></div>
        <div className="stat"><div className="stat-top"><span className="stat-label">Your role</span></div><span className="stat-num">{ROLE_LABEL[current!.role]}</span></div>
        <div className="stat"><div className="stat-top"><span className="stat-label">Created</span></div><span className="stat-num">{new Date(org.data.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
      </section>
      <div className="grid-2">
        <section className="panel" aria-labelledby="abil"><div className="panel-head"><h2 id="abil">What you can do here</h2></div>
          <ul className="abilities">{abilitiesFor(current!.role, me.id, orgId).map(a => (
            <li key={a.label} className={a.allowed ? 'yes' : 'no'}><Icon name={a.allowed ? 'check' : 'x'} size={15} /><span>{a.label}</span>
              <span className="sr-only">{a.allowed ? ' (allowed)' : ' (not allowed for your role)'}</span></li>))}</ul>
        </section>
        <section className="panel" aria-labelledby="board"><div className="panel-head"><h2 id="board">Staff tasks</h2></div>
          <p className="muted">The task board your team uses behind the scenes. It is a demo for now and keeps its data in this browser, separate from the camp.</p>
          <a className="btn" href="#/dashboard"><Icon name="kanban" size={16} /> Open the staff board</a>
        </section>
      </div>
      {renaming && <RenameDialog org={org.data} orgId={orgId} onClose={() => setRenaming(false)} onDone={org.retry} />}
    </div>
  );
}

/* ---------- Members ---------- */
function MembersPage() {
  const { api, current } = useCamp();
  const orgId = current!.orgId;
  const r = useLoad(() => api.members(orgId), [api, orgId]);
  if (r.status === 'loading') return <Loading what="members" />;
  if (r.status === 'error') return <Problem error={r.error} retry={r.retry} />;
  const list: Member[] = r.data.members;
  return (
    <div className="page">
      <header className="page-head"><div className="page-title"><h1>Members</h1><p className="muted">{list.length} {list.length === 1 ? 'person has' : 'people have'} access to this camp. Inviting people is not available yet.</p></div></header>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>{list.map(m => (
          <tr key={m.id}><td><span className="row"><Avatar user={{ name: m.name }} size={26} /> {m.name}</span></td><td>{m.email}</td>
            <td><Pill tone={m.role === 'owner' ? 'brand' : 'neutral'} dot={false}>{ROLE_LABEL[m.role]}</Pill></td></tr>))}</tbody>
      </table></div>
    </div>
  );
}

/* ---------- Shell ---------- */
function useCampMe() { const { state } = useCamp(); if (state.status !== 'ready') throw new Error('not ready'); return state.me.user; }
function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

function CampShell({ children }: { children: ReactNode }) {
  const { state, current, selectOrg } = useCamp(); const { signOut } = useAuth(); const { sidebarOpen, setSidebarOpen } = useUi();
  const hash = useHash(); const route = parseCampHash(hash); const [dark, setDark] = useState(isDark());
  useEffect(() => { setSidebarOpen(false); }, [hash, setSidebarOpen]);
  if (state.status !== 'ready') return null;
  const { user, orgs } = state.me;
  const NAV = [{ key: 'overview', label: 'Overview', icon: 'dashboard', to: '/camp' }, { key: 'members', label: 'Members', icon: 'users', to: '/camp/members' }];
  return (
    <div className={`shell ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-head"><a className="brand" href="#/camp"><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></a></div>
        <nav><ul>
          {NAV.map(n => (<li key={n.key}><a href={'#' + n.to} className={route.name === n.key ? 'active' : ''} aria-current={route.name === n.key ? 'page' : undefined}><Icon name={n.icon} size={18} /><span className="collapsible">{n.label}</span></a></li>))}
          <li><a href="#/dashboard"><Icon name="kanban" size={18} /><span className="collapsible">Staff board</span></a></li>
        </ul></nav>
      </aside>
      {sidebarOpen && <div className="nav-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div className="crumbs">
            <Menu label="Switch camp" className="crumb" align="start" trigger={<><span className="crumb-text">{current?.name ?? 'No camp yet'}</span><Icon name="down" size={14} /></>}
              items={[...orgs.map(o => ({ label: o.name, checked: o.orgId === current?.orgId, onSelect: () => { selectOrg(o.orgId); go('/camp'); } })),
                ...(orgs.length ? [{ label: '', divider: true, onSelect() {} }] : []), { label: 'New camp…', icon: 'plus', onSelect: () => go('/camp/new') }]} />
          </div>
          <span style={{ flex: 1 }} />
          <Menu label="Account" className="avatar-btn" trigger={<Avatar user={user} size={30} />}
            items={[{ label: user.email, icon: 'user', onSelect() {} }, { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: () => { setTheme(!dark); setDark(!dark); } },
              { label: '', divider: true, onSelect() {} }, { label: 'Sign out', icon: 'logout', onSelect: () => void signOut() }]} />
        </header>
        <main id="main" tabIndex={-1} className="main">{children}</main>
      </div>
    </div>
  );
}

/* ---------- Gate ---------- */
function Gate() {
  const { state: auth, signOut } = useAuth(); const { state, current, reload } = useCamp(); const route = parseCampHash(useHash());
  if (state.status === 'loading') return <main className="auth"><div className="auth-card" aria-busy="true" role="status"><p className="muted">Loading…</p></div></main>;
  if (state.status === 'error') {
    const expired = state.error.status === 401;
    return <main className="auth"><div className="auth-card"><Empty icon="alert" title={expired ? 'Your session has ended' : 'Cannot reach Buxa'} body={state.error.message}
      action={<div className="row">{!expired && <button className="btn btn-primary" onClick={() => void reload()}>Try again</button>}<button className="btn" onClick={() => void signOut()}>Sign out</button></div>} /></div></main>;
  }
  void auth;
  if (!current) return <CampShell><NewCamp first /></CampShell>;
  return <CampShell>{route.name === 'overview' ? <Overview /> : route.name === 'members' ? <MembersPage /> : route.name === 'new' ? <NewCamp first={false} />
    : <div className="page"><Empty icon="alert" title="Page not found" action={<a className="btn" href="#/camp">Go to overview</a>} /></div>}</CampShell>;
}

function AuthGate() {
  const { state } = useAuth();
  if (state.status === 'loading') return <main className="auth"><div className="auth-card" aria-busy="true" role="status"><p className="muted">Loading…</p></div></main>;
  if (state.status === 'out') return <SignIn />;
  return <CampProvider><Gate /></CampProvider>;
}

export function CampApp() {
  if (!supabase) return <NotConfigured />;
  return <AuthProvider><UiProvider><AuthGate /></UiProvider></AuthProvider>;
}
