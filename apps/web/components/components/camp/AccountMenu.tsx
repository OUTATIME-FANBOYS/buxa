'use client';

import { useRef } from 'react';
import type { User } from '@buxa/contracts';
import { Avatar } from '@/components/elements/export';
import { Menu } from '@/components/components/export';
import { signOut } from '@/actions/auth';
import { useDarkMode } from '@buxa/middleware/hooks/hooks';
import { ROUTES } from '@/config/routes';

/** The avatar menu, headed by the user's name: profile, settings, help, reports, light/dark, sign out. Signing out is a Server Action submitted through a form. */
export function AccountMenu({ user }: { user: User }) {
  const { dark, toggle } = useDarkMode();
  const form = useRef<HTMLFormElement>(null);

  return (
    <>
      <Menu
        label="Account"
        className="avatar-btn"
        trigger={<Avatar user={user} size={30} />}
        header={user.name}
        items={[
          { label: 'Profile', icon: 'user', href: `${ROUTES.settings}#profile` },
          { label: 'Settings', icon: 'settings', href: ROUTES.settings },
          { label: 'Help', icon: 'help', href: ROUTES.help },
          { label: 'Reports', icon: 'chart', href: ROUTES.reports },
          { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: toggle },
          { label: '', divider: true, onSelect() {} },
          { label: 'Sign out', icon: 'logout', onSelect: () => form.current?.requestSubmit() },
        ]}
      />
      <form ref={form} action={signOut} hidden />
    </>
  );
}
