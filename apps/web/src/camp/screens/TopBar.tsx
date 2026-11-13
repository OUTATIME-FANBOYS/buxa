import { useState } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { Icon } from '../../components/Icon';
import { Avatar, Menu, useUi } from '../../components/ui';
import { go } from '../lib/routing';
import { isDark, setTheme } from '../lib/theme';

interface Props { user: User; orgs: readonly Membership[]; current: Membership | null; onSelect: (orgId: string) => void; onSignOut: () => void }

export function TopBar({ user, orgs, current, onSelect, onSignOut }: Props) {
  const { setSidebarOpen } = useUi();
  const [dark, setDark] = useState(isDark);
  const toggleTheme = () => { setTheme(!dark); setDark(!dark); };

  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
      <div className="crumbs">
        <Menu label="Switch camp" className="crumb" align="start"
          trigger={<><span className="crumb-text">{current?.name ?? 'No camp yet'}</span><Icon name="down" size={14} /></>}
          items={[
            ...orgs.map(o => ({ label: o.name, checked: o.orgId === current?.orgId, onSelect: () => { onSelect(o.orgId); go('/camp'); } })),
            ...(orgs.length ? [{ label: '', divider: true, onSelect() {} }] : []),
            { label: 'New camp…', icon: 'plus', onSelect: () => go('/camp/new') },
          ]} />
      </div>
      <span style={{ flex: 1 }} />
      <Menu label="Account" className="avatar-btn" trigger={<Avatar user={user} size={30} />}
        items={[
          { label: user.email, icon: 'user', onSelect() {} },
          { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: toggleTheme },
          { label: '', divider: true, onSelect() {} },
          { label: 'Sign out', icon: 'logout', onSelect: onSignOut },
        ]} />
    </header>
  );
}
