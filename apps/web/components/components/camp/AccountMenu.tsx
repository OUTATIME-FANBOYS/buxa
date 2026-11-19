'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClockFormat, User } from '@buxa/contracts';
import type { ThemePref } from '@buxa/shared';
import { browserClockFormat } from '@buxa/shared/clockPreference';
import { Avatar } from '@/components/elements';
import { Menu } from '@/components/components';
import { signOut } from '@/actions/auth';
import { updateTimeFormatAction } from '@/actions/account';
import { ROUTES } from '@/config/routes';
import { useAppearance } from './useAppearance';

const APPEARANCE: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The avatar menu, headed by the person's first name: Profile, Appearance and Time format (both submenus, as in Cloudflare),
 * Settings, Reports, then Sign out. Signing out is a Server Action submitted through a form.
 */
export function AccountMenu({ user }: { user: User }) {
  const [theme, setTheme] = useAppearance();
  const form = useRef<HTMLFormElement>(null);
  // The browser's clock is read after mount, because the server cannot know it.
  const [browser, setBrowser] = useState<ClockFormat>('24h');
  useEffect(() => {
    setBrowser(browserClockFormat());
  }, []);
  const clock: ClockFormat = user.clockFormat ?? browser;

  return (
    <>
      <Menu
        label="Account"
        className="avatar-btn"
        trigger={<Avatar user={user} size={30} />}
        header={user.firstName}
        items={[
          { label: '', divider: true, onSelect() {} },
          { label: 'Profile', icon: 'user', href: `${ROUTES.settings}#profile` },
          {
            label: 'Appearance',
            icon: 'sun',
            submenu: APPEARANCE.map(a => ({
              label: a.label,
              checked: theme === a.value,
              onSelect: () => setTheme(a.value),
            })),
          },
          {
            label: 'Time format',
            icon: 'clock',
            submenu: [
              {
                label: '12-hour clock',
                checked: clock === '12h',
                onSelect: () => void updateTimeFormatAction({ clockFormat: '12h' }),
              },
              {
                label: '24-hour clock',
                checked: clock === '24h',
                onSelect: () => void updateTimeFormatAction({ clockFormat: '24h' }),
              },
            ],
          },
          { label: 'Settings', icon: 'settings', href: ROUTES.settings },
          { label: 'Reports', icon: 'chart', href: ROUTES.reports },
          { label: '', divider: true, onSelect() {} },
          { label: 'Sign out', icon: 'logout', onSelect: () => form.current?.requestSubmit() },
        ]}
      />
      <form ref={form} action={signOut} hidden />
    </>
  );
}
