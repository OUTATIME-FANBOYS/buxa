'use client';

import type { ThemePref } from '@buxa/shared';
import { useAppearance } from '@/components/components/camp';
import { Segmented } from '@/components/elements';
import {
  CARD_SEGMENTED,
  SETTINGS_CHOICE,
  SETTINGS_CHOICE_CONTROL,
  SETTINGS_CHOICE_TEXT,
  SETTINGS_TILE_HEADING,
} from './styles';

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
    <section
      className={`panel settings-tile settings-choice ${SETTINGS_CHOICE} ${className ?? ''}`}
      aria-labelledby="appearance-title"
    >
      <div className={`settings-choice__text ${SETTINGS_CHOICE_TEXT}`}>
        <h2 id="appearance-title" className={SETTINGS_TILE_HEADING}>
          Appearance
        </h2>
        <p className="muted">Light or dark, or follow your device’s setting.</p>
      </div>
      <div className={`settings-choice__control ${SETTINGS_CHOICE_CONTROL}`}>
        <Segmented
          label="Theme"
          value={theme}
          onChange={value => setTheme(value as ThemePref)}
          options={APPEARANCE}
          className={CARD_SEGMENTED}
        />
      </div>
    </section>
  );
}
