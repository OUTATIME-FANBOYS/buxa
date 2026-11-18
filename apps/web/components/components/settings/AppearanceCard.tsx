'use client';

import type { ThemePref } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { RadioGroup } from '@/components/atoms';

const APPEARANCE: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light, dark or system, for this device. Choosing one applies it at once through the same store action the account menu's
 * Appearance submenu uses, and the theme provider writes it to the page.
 */
export function AppearanceCard({ className }: { className?: string }) {
  const { s, actions } = useStore();

  return (
    <section className={`panel settings-tile ${className ?? ''}`} aria-labelledby="appearance-title">
      <h2 id="appearance-title">Appearance</h2>
      <p className="muted">Light or dark, or follow your device’s setting.</p>
      <RadioGroup
        label="Theme"
        value={s.ui.theme}
        onChange={value => actions.setTheme(value as ThemePref)}
        options={APPEARANCE}
      />
    </section>
  );
}
