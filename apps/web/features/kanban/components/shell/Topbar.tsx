import type { RefObject } from 'react';
import { Avatar, Icon, Menu, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import { navigate } from '../../lib/router';
import { GlobalSearch } from './GlobalSearch';
import { Notifications } from './Notifications';

export type ShellDialog = 'project' | 'workspace' | null;

function useSaveLabel() {
  const { saveStatus, sync } = useStore();
  if (sync === 'offline') return 'Offline, retrying';
  if (saveStatus === 'error') return 'Not saved — storage full';
  if (sync === 'synced') return saveStatus === 'saving' ? 'Syncing…' : 'Synced';
  return saveStatus === 'saving' ? 'Saving…' : 'Saved';
}

export function Topbar({ searchRef, onDialog }: { searchRef: RefObject<HTMLInputElement | null>; onDialog: (d: ShellDialog) => void }) {
  const { s, actions, me, workspace, project, projects, myWorkspaces, saveStatus, sync } = useStore();
  const { setSidebarOpen, toast } = useUi();
  const saveLabel = useSaveLabel();
  const dark = s.ui.theme === 'dark';
  const divider = { label: '', divider: true, onSelect() {} };
  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
      <div className="crumbs">
        <Menu label="Switch workspace" className="crumb" align="start"
          trigger={<><span className="crumb-text">{workspace?.name ?? 'No workspace'}</span><Icon name="down" size={14} /></>}
          items={[...myWorkspaces.map(w => ({ label: w.name, checked: w.id === workspace?.id, onSelect: () => { actions.selectWorkspace(w.id); navigate('/dashboard'); } })), divider, { label: 'New workspace…', icon: 'plus', onSelect: () => onDialog('workspace') }]} />
        <span className="crumb-sep" aria-hidden="true">/</span>
        <Menu label="Switch project" className="crumb" align="start"
          trigger={<><span className="crumb-text">{project?.name ?? 'No project'}</span><Icon name="down" size={14} /></>}
          items={[...projects.map(p => ({ label: p.name, checked: p.id === project?.id, onSelect: () => { actions.selectProject(p.id); navigate('/board/' + p.id); } })), projects.length ? divider : null, { label: 'New project…', icon: 'plus', onSelect: () => onDialog('project') }]} />
      </div>
      <GlobalSearch inputRef={searchRef} />
      <span className={`save-state save-${sync === 'offline' ? 'error' : saveStatus}`} role="status">{saveLabel}</span>
      <Notifications />
      <Menu label="Account" className="avatar-btn" trigger={<Avatar user={me} size={30} />}
        items={[
          { label: me?.name ?? '', icon: 'user', onSelect: () => navigate('/settings') },
          { label: 'Settings', icon: 'settings', onSelect: () => navigate('/settings') },
          { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: () => actions.setTheme(dark ? 'light' : 'dark') },
          divider,
          ...s.users.filter(u => u.id !== me?.id && s.accounts.some(a => a.userId === u.id && a.demo)).slice(0, 4).map(u => ({ label: `Switch to ${u.name}`, icon: 'users', onSelect: () => { actions.switchUser(u.id); toast(`Now viewing as ${u.name}`); navigate('/dashboard'); } })),
          divider,
          { label: 'Sign out', icon: 'logout', onSelect: () => actions.signOut() },
        ]} />
    </header>
  );
}
