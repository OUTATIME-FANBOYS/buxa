'use client';

import { useEffect, useState } from 'react';
import type { ClockFormat } from '@buxa/contracts';
import { browserClockFormat } from '@buxa/shared/clockPreference';
import { Segmented } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { updateTimeFormatAction } from '@/actions/account';
import {
  CARD_SEGMENTED,
  SETTINGS_CHOICE,
  SETTINGS_CHOICE_CONTROL,
  SETTINGS_CHOICE_TEXT,
  SETTINGS_TILE_HEADING,
} from './styles';

const TIME_FORMATS: { value: ClockFormat; label: string }[] = [
  { value: '24h', label: '24-hour' },
  { value: '12h', label: '12-hour' },
];

/**
 * The person's own 12-hour or 24-hour clock. Choosing one applies it at once: the choice shows, then the server saves it. If the save
 * fails the choice goes back to what it was. Until the person chooses, the browser's setting is shown.
 */
export function TimeFormatCard({
  clockFormat,
  className,
  onSaved,
}: {
  /** The person's saved choice, or undefined when they have not chosen one yet. */
  clockFormat: ClockFormat | undefined;
  className?: string;
  onSaved?: (format: ClockFormat) => void;
}) {
  const { toast } = useUi();
  const [browser, setBrowser] = useState<ClockFormat>('24h');
  const [format, setFormat] = useState<ClockFormat | undefined>(clockFormat);
  useEffect(() => {
    setBrowser(browserClockFormat());
  }, []);
  useEffect(() => {
    setFormat(clockFormat);
  }, [clockFormat]);

  const shown: ClockFormat = format ?? browser;

  const choose = async (next: ClockFormat) => {
    const previous = shown;
    setFormat(next);
    const saved = await updateTimeFormatAction({ clockFormat: next });
    if (saved.status === 'error') {
      setFormat(previous);
      toast(saved.message, { tone: 'error' });

      return;
    }
    onSaved?.(next);
  };

  return (
    <section
      className={`panel settings-tile settings-choice ${SETTINGS_CHOICE} ${className ?? ''}`}
      aria-labelledby="time-format-title"
    >
      <div className={`settings-choice__text ${SETTINGS_CHOICE_TEXT}`}>
        <h2 id="time-format-title" className={SETTINGS_TILE_HEADING}>
          Time format
        </h2>
        <p className="muted">How times show for you. Until you choose, your browser’s setting is used.</p>
      </div>
      <div className={`settings-choice__control ${SETTINGS_CHOICE_CONTROL}`}>
        <Segmented
          label="Format"
          value={shown}
          onChange={value => void choose(value as ClockFormat)}
          options={TIME_FORMATS}
          className={CARD_SEGMENTED}
        />
      </div>
    </section>
  );
}
