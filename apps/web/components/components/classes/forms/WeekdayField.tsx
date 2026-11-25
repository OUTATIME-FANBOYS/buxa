'use client';

import { useState } from 'react';
import { Button } from '@/components/elements';

/** ISO weekdays as the recurring rule reads them: 1 is Monday, 7 is Sunday. `letter` is the chip's text; `name` its accessible name. */
export const WEEKDAYS = [
  { value: '1', letter: 'M', name: 'Monday' },
  { value: '2', letter: 'T', name: 'Tuesday' },
  { value: '3', letter: 'W', name: 'Wednesday' },
  { value: '4', letter: 'T', name: 'Thursday' },
  { value: '5', letter: 'F', name: 'Friday' },
  { value: '6', letter: 'S', name: 'Saturday' },
  { value: '7', letter: 'S', name: 'Sunday' },
];

/** Monday to Friday, the days a new class starts on. */
export const DEFAULT_WEEKDAYS: readonly string[] = ['1', '2', '3', '4', '5'];

/**
 * The days of the week a class runs on, between its Starts and Ends date-times. A row of toggle chips: All (on the left) selects
 * all seven days, or clears them when all seven are already selected; each day chip toggles on its own. The chosen days are posted
 * as hidden `weekdays` fields. The form checks there is at least one before it submits (see ClassForm).
 */
export function WeekdayField({ error, initial = DEFAULT_WEEKDAYS }: { error?: string; initial?: readonly string[] }) {
  const [selected, setSelected] = useState<readonly string[]>(initial);
  const allSelected = WEEKDAYS.every(day => selected.includes(day.value));

  const toggleDay = (value: string) => {
    setSelected(current => (current.includes(value) ? current.filter(day => day !== value) : [...current, value]));
  };
  const toggleAll = () => {
    setSelected(allSelected ? [] : WEEKDAYS.map(day => day.value));
  };

  return (
    <section className="form-section">
      <h3 id="class-weekdays" className="form-section__title">
        Days of the week
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </h3>
      <div className="weekday-row" role="group" aria-labelledby="class-weekdays">
        <Button
          type="button"
          variant={allSelected ? 'primary' : 'secondary'}
          className="weekday-chip"
          aria-pressed={allSelected}
          onClick={toggleAll}
        >
          All
        </Button>
        {WEEKDAYS.map(day => {
          const on = selected.includes(day.value);

          return (
            <Button
              key={day.value}
              type="button"
              variant={on ? 'primary' : 'secondary'}
              className="weekday-chip"
              aria-label={day.name}
              aria-pressed={on}
              onClick={() => toggleDay(day.value)}
            >
              {day.letter}
            </Button>
          );
        })}
      </div>
      {selected.map(value => (
        <input key={value} type="hidden" name="weekdays" value={value} />
      ))}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}
