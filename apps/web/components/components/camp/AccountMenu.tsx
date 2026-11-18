'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClockFormat, User } from '@buxa/contracts';
import type { ThemePref } from '@buxa/shared';
import { browserClockFormat, localTimeZone } from '@buxa/shared/clockPreference';
import { Avatar } from '@/components/elements';
import { Menu } from '@/components/components';
import { signOut } from '@/actions/auth';
import { updateTimeFormatAction } from '@/actions/account';
import { useStore } from '@buxa/middleware/providers/providers';
import { ROUTES } from '@/config/routes';

const APPEARANCE: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * The avatar menu, headed by the person's first name: Profile, Appearance and Timezone (both submenus, as in Cloudflare), Settings,
 * Help, Reports, then Sign out. Signing out is a Server Action submitted through a form.
 */
export function AccountMenu({ user }: { user: User }) {
  const { s, actions } = useStore();
  const form = useRef<HTMLFormElement>(null);
  // The browser's clock and time zone are read after mount, because the server cannot know them.
  const [browser, setBrowser] = useState<ClockFormat>('24h');
  const [zone, setZone] = useState('');
  useEffect(() => {
    setBrowser(browserClockFormat());
    setZone(localTimeZone());
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
              checked: s.ui.theme === a.value,
              onSelect: () => actions.setTheme(a.value),
            })),
          },
          {
            label: 'Timezone',
            icon: 'clock',
            submenu: [
              { label: `Local time${zone ? ` (${zone})` : ''}`, checked: true, onSelect() {} },
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
          { label: 'Help', icon: 'help', href: ROUTES.help },
          { label: 'Reports', icon: 'chart', href: ROUTES.reports },
          { label: '', divider: true, onSelect() {} },
          { label: 'Sign out', icon: 'logout', onSelect: () => form.current?.requestSubmit() },
        ]}
      />
      <form ref={form} action={signOut} hidden />
    </>
  );
}
