'use client';

import type { ThemePref } from '@buxa/shared';
import { useAppearance } from '@/components/components/camp';
import { Select } from '@/components/atoms';

const APPEARANCE: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light, dark or system, for this device. Choosing one applies it at once, the same way the account menu's Appearance submenu does.
 */
export function AppearanceCard({ className }: { className?: string }) {
  const [theme, setTheme] = useAppearance();

  return (
    <section className={`panel settings-tile settings-choice ${className ?? ''}`} aria-labelledby="appearance-title">
      <div className="settings-choice__text">
        <h2 id="appearance-title">Appearance</h2>
        <p className="muted">Light or dark, or follow your device’s setting.</p>
      </div>
      <Select
        label="Appearance"
        hideLabel
        value={theme}
        onChange={value => value && setTheme(value as ThemePref)}
        options={APPEARANCE}
      />
    </section>
  );
}
