'use client';

import { Checkbox } from '@/components/atoms';

/** ISO weekdays as the recurring rule reads them: 1 is Monday, 7 is Sunday. */
export const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

/**
 * The "Specific days" weekday row: the days the classes run on, between the Starts and Ends date-times. At least one is required;
 * the server refuses none with the same message as the recurring path (recurringClassForm in @buxa/shared).
 */
export function WeekdayField({ error }: { error?: string }) {
  return (
    <section className="form-section" aria-labelledby="specific-days-weekdays">
      <h3 id="specific-days-weekdays" className="form-section__title">
        Days of the week
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </h3>
      <div className="weekday-row">
        {WEEKDAYS.map(day => (
          <Checkbox key={day.value} name="weekdays" value={day.value}>
            {day.label}
          </Checkbox>
        ))}
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}
