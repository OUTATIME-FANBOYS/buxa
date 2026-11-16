'use client';

import { useRouter } from 'next/navigation';
import { Avatar, Menu, useUi } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useStore } from '../../state/store';

/** The account menu for the browser demo: switch between demo accounts, light/dark, sign out of the demo. */
export function DemoAccountMenu() {
  const router = useRouter();
  const { s, actions, me } = useStore();
  const { toast } = useUi();
  const dark = s.ui.theme === 'dark';
  const divider = { label: '', divider: true, onSelect() {} };
  const others = s.users.filter(u => u.id !== me?.id && s.accounts.some(a => a.userId === u.id && a.demo)).slice(0, 4);
  return (
    <Menu label="Account" className="avatar-btn" trigger={<Avatar user={me} size={30} />}
      items={[
        { label: me?.name ?? '', icon: 'user', onSelect: () => router.push(ROUTES.settings) },
        { label: 'Settings', icon: 'settings', onSelect: () => router.push(ROUTES.settings) },
        { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: () => actions.setTheme(dark ? 'light' : 'dark') },
        divider,
        ...others.map(u => ({ label: `Switch to ${u.name}`, icon: 'users', onSelect: () => { actions.switchUser(u.id); toast(`Now viewing as ${u.name}`); } })),
        divider,
        { label: 'Sign out of the demo', icon: 'logout', onSelect: () => actions.signOut() },
      ]} />
  );
}
