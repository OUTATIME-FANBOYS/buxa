import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { Icon } from './Icon';
import { Avatar, Menu, Popover, useUi, Empty } from './ui';
import { navigate, type Route } from '../lib/router';
import { ProjectDialog, WorkspaceDialog } from './dialogs';
import { ago, diffDays, today } from '../lib/dates';

const NAV: { key: Route['name']; label: string; icon: string; to: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { key: 'my-tasks', label: 'My Tasks', icon: 'tasks', to: '/my-tasks' },
  { key: 'projects', label: 'Projects', icon: 'folder', to: '/projects' },
  { key: 'board', label: 'Kanban Boards', icon: 'kanban', to: '/board' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', to: '/calendar' },
  { key: 'team', label: 'Team', icon: 'users', to: '/team' },
  { key: 'agents', label: 'Agents', icon: 'agent', to: '/agents' },
  { key: 'reports', label: 'Reports', icon: 'chart', to: '/reports' },
  { key: 'settings', label: 'Settings', icon: 'settings', to: '/settings' },
];

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { s, actions, me, workspace, project, projects, myWorkspaces, saveStatus, sync } = useStore();
  const saveLabel = sync === 'offline' ? 'Offline, retrying' : saveStatus === 'error' ? 'Not saved — storage full' : sync === 'synced' ? (saveStatus === 'saving' ? 'Syncing…' : 'Synced') : saveStatus === 'saving' ? 'Saving…' : 'Saved';
  const { sidebarOpen, setSidebarOpen, toast, openTask } = useUi();
  const [dlg, setDlg] = useState<'project' | 'workspace' | null>(null);
  const collapsed = s.ui.sidebarCollapsed;
  const searchRef = useRef<HTMLInputElement>(null);
  const waiting = s.ui.agentsEnabled && workspace ? s.proposals.filter(p => p.status === 'pending' && s.agents.find(a => a.userId === p.agentId)?.workspaceId === workspace.id).length : 0;
  const nav = NAV.filter(n => n.key !== 'agents' || s.ui.agentsEnabled);

  useEffect(() => { setSidebarOpen(false); }, [route, setSidebarOpen]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c' && project && !document.querySelector('[role=dialog]')) { e.preventDefault(); openTask('new'); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [project, openTask]);

  return (
    <div className={`shell ${collapsed ? 'is-collapsed' : ''} ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-head">
          <a className="brand" href="#/dashboard"><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></a>
        </div>
        <nav>
          <ul>
            {nav.map(n => {
              const active = route.name === n.key;
              const to = n.key === 'board' && project ? '/board/' + project.id : n.to;
              return (
                <li key={n.key}>
                  <a href={'#' + to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} title={collapsed ? n.label : undefined}>
                    <Icon name={n.icon} size={18} /><span className="collapsible">{n.label}</span>
                    {n.key === 'agents' && waiting > 0 && <span className="nav-badge" aria-label={`${waiting} waiting for approval`}>{waiting}</span>}
                  </a>
                  {n.key === 'board' && !collapsed && projects.length > 0 && (
                    <ul className="subnav">
                      {projects.map(p => (
                        <li key={p.id}><a href={'#/board/' + p.id} className={route.name === 'board' && project?.id === p.id ? 'active' : ''}>{p.name}</a></li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <button className="collapse-btn" onClick={() => actions.setUi({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
          <Icon name="panel" size={18} /><span className="collapsible">Collapse</span>
        </button>
      </aside>
      {sidebarOpen && <div className="nav-scrim" onClick={() => setSidebarOpen(false)} />}

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div className="crumbs">
            <Menu label="Switch workspace" className="crumb" align="start"
              trigger={<><span className="crumb-text">{workspace?.name ?? 'No workspace'}</span><Icon name="down" size={14} /></>}
              items={[...myWorkspaces.map(w => ({ label: w.name, checked: w.id === workspace?.id, onSelect: () => { actions.selectWorkspace(w.id); navigate('/dashboard'); } })), { label: '', divider: true, onSelect() {} }, { label: 'New workspace…', icon: 'plus', onSelect: () => setDlg('workspace') }]} />
            <span className="crumb-sep" aria-hidden="true">/</span>
            <Menu label="Switch project" className="crumb" align="start"
              trigger={<><span className="crumb-text">{project?.name ?? 'No project'}</span><Icon name="down" size={14} /></>}
              items={[...projects.map(p => ({ label: p.name, checked: p.id === project?.id, onSelect: () => { actions.selectProject(p.id); navigate('/board/' + p.id); } })), projects.length ? { label: '', divider: true, onSelect() {} } : null, { label: 'New project…', icon: 'plus', onSelect: () => setDlg('project') }]} />
          </div>
          <GlobalSearch inputRef={searchRef} />
          <span className={`save-state save-${sync === 'offline' ? 'error' : saveStatus}`} role="status">
            {saveLabel}
          </span>
          <Notifications />
          <Menu label="Account" className="avatar-btn" trigger={<Avatar user={me} size={30} />}
            items={[
              { label: me?.name ?? '', icon: 'user', onSelect: () => navigate('/settings') },
              { label: 'Settings', icon: 'settings', onSelect: () => navigate('/settings') },
              { label: s.ui.theme === 'dark' ? 'Light mode' : 'Dark mode', icon: s.ui.theme === 'dark' ? 'sun' : 'moon', onSelect: () => actions.setTheme(s.ui.theme === 'dark' ? 'light' : 'dark') },
              { label: '', divider: true, onSelect() {} },
              ...s.users.filter(u => u.id !== me?.id && s.accounts.some(a => a.userId === u.id && a.demo)).slice(0, 4).map(u => ({ label: `Switch to ${u.name}`, icon: 'users', onSelect: () => { actions.switchUser(u.id); toast(`Now viewing as ${u.name}`); navigate('/dashboard'); } })),
              { label: '', divider: true, onSelect() {} },
              { label: 'Sign out', icon: 'logout', onSelect: () => actions.signOut() },
            ]} />
        </header>
        <main id="main" tabIndex={-1} className="main">{children}</main>
      </div>
      {dlg === 'project' && <ProjectDialog onClose={() => setDlg(null)} />}
      {dlg === 'workspace' && <WorkspaceDialog onClose={() => setDlg(null)} />}
    </div>
  );
}

function GlobalSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const { wsTasks, userById, s } = useStore(); const { openTask } = useUi();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [i, setI] = useState(0);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase(); if (!t) return [];
    return wsTasks.filter(x => x.title.toLowerCase().includes(t) || x.description.toLowerCase().includes(t) || x.tags.some(g => g.includes(t))).slice(0, 8);
  }, [q, wsTasks]);
  const pick = (id: string) => { setOpen(false); setQ(''); inputRef.current?.blur(); openTask(id); };
  return (
    <div className="search" role="search">
      <Icon name="search" size={15} />
      <input ref={inputRef} value={q} placeholder="Search tasks" aria-label="Search all tasks" role="combobox" aria-expanded={open && !!q} aria-controls="search-results"
        onChange={e => { setQ(e.target.value); setOpen(true); setI(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(results.length - 1, x + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
          if (e.key === 'Enter' && results[i]) pick(results[i].id);
          if (e.key === 'Escape') { setQ(''); inputRef.current?.blur(); }
        }} />
      <kbd className="kbd">⌘K</kbd>
      {open && q.trim() && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.length === 0 && <li className="search-none">No tasks match “{q}”.</li>}
          {results.map((t, n) => (
            <li key={t.id} role="option" aria-selected={n === i} className={n === i ? 'on' : ''} onMouseDown={e => { e.preventDefault(); pick(t.id); }} onMouseEnter={() => setI(n)}>
              <span className="sr-title">{t.title}</span>
              <span className="muted small">{s.projects.find(p => p.id === t.projectId)?.name}{t.assigneeId ? ' · ' + userById(t.assigneeId)?.name : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notifications() {
  const { s, me, wsTasks, kindOf, actions } = useStore(); const { openTask } = useUi();
  const [open, setOpen] = useState(false); const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const reminders = useMemo(() => wsTasks.filter(t => t.assigneeId === me?.id && !t.archived && kindOf(t) !== 'done' && t.due && diffDays(t.due, today()) <= 1)
    .sort((a, b) => a.due!.localeCompare(b.due!)).map(t => {
      const n = diffDays(t.due!, today());
      return { id: t.id, taskId: t.id, overdue: n < 0, text: n < 0 ? `“${t.title}” is ${-n} day${n === -1 ? '' : 's'} overdue` : n === 0 ? `“${t.title}” is due today` : `“${t.title}” is due tomorrow` };
    }), [wsTasks, me, kindOf]);
  const mine = s.notices.filter(n => n.userId === me?.id);
  const unread = mine.filter(n => !n.read).length + reminders.length;
  return (
    <>
      <button ref={btn} className="icon-btn bell" aria-label={`Notifications${unread ? `, ${unread} need attention` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="bell" />{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={close} align="end" width={360} label="Notifications" className="notif">
          <div className="notif-head"><strong>Notifications</strong><button className="link" onClick={actions.markAllRead} disabled={!mine.some(n => !n.read)}>Mark all read</button></div>
          <div className="notif-list">
            {reminders.length > 0 && <div className="eyebrow pad">Needs attention</div>}
            {reminders.map(r => (
              <button key={r.id} className="notif-item" onClick={() => { close(); openTask(r.taskId); }}>
                <span className={`notif-dot ${r.overdue ? 'crit' : 'warn'}`}><Icon name="clock" size={14} /></span><span>{r.text}</span>
              </button>
            ))}
            {mine.length > 0 && <div className="eyebrow pad">Recent</div>}
            {mine.slice(0, 15).map(n => (
              <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => { actions.markNoticeRead(n.id); if (n.taskId && s.tasks.some(t => t.id === n.taskId)) { close(); openTask(n.taskId); } }}>
                <span className="notif-dot"><Icon name={n.kind === 'mention' ? 'at' : n.kind === 'comment' ? 'message' : n.kind === 'complete' ? 'check' : n.kind === 'invite' ? 'users' : 'tasks'} size={14} /></span>
                <span><span>{n.text}</span><span className="muted small block">{ago(n.at)}</span></span>
              </button>
            ))}
            {!reminders.length && !mine.length && <Empty icon="bell" title="You’re all caught up" body="Assignments, mentions and deadlines will show up here." />}
          </div>
        </Popover>
      )}
    </>
  );
}
