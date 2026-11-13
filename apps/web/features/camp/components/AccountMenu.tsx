'use client';

import { useRef } from 'react';
import type { User } from '@buxa/contracts';
import { Avatar, Menu } from '@/components/ui';
import { signOut } from '@/features/auth';
import { useDarkMode } from './useDarkMode';

/** The avatar menu: who you are, light/dark, sign out. Signing out is a Server Action submitted through a form. */
export function AccountMenu({ user }: { user: User }) {
  const { dark, toggle } = useDarkMode();
  const form = useRef<HTMLFormElement>(null);
  return (
    <>
      <Menu label="Account" className="avatar-btn" trigger={<Avatar user={user} size={30} />}
        items={[
          { label: user.email, icon: 'user', onSelect() {} },
          { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onSelect: toggle },
          { label: '', divider: true, onSelect() {} },
          { label: 'Sign out', icon: 'logout', onSelect: () => form.current?.requestSubmit() },
        ]} />
      <form ref={form} action={signOut} hidden />
    </>
  );
}
