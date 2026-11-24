import { describe, expect, it } from 'vitest';
import { expandClassRule } from '@buxa/domain';
import { specificDaysForm } from '../parse';

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }

  return data;
}

const base = {
  name: 'Swimming',
  minAge: '8',
  maxAge: '12',
  capacity: '20',
  location: 'Pool',
  startsAt: '2027-07-05T09:00',
  endsAt: '2027-07-30T10:30',
};

describe('specificDaysForm: the weekdays between Starts and Ends', () => {
  it('takes the range and the times from Starts and Ends into a weekly rule', () => {
    const parsed = specificDaysForm(form({ ...base, weekdays: ['1', '3'] }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.rule).toEqual({
        weekdays: [1, 3],
        firstDate: '2027-07-05',
        startTime: '09:00',
        endTime: '10:30',
        end: { kind: 'until', date: '2027-07-30' },
      });
    }
  });

  it('runs the classes only on the chosen weekdays between the two date-times', () => {
    const parsed = specificDaysForm(form({ ...base, weekdays: ['2', '4'] }));
    if (!parsed.ok) {
      throw new Error('expected the form to parse');
    }
    const expanded = expandClassRule(parsed.data.rule, 'Australia/Sydney');

    expect(expanded.ok).toBe(true);
    if (expanded.ok) {
      const days = expanded.occurrences.map(o => o.date);
      expect(days.length).toBeGreaterThan(0);
      for (const day of days) {
        const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
        expect([2, 4]).toContain(weekday);
        expect(day >= '2027-07-05' && day <= '2027-07-30').toBe(true);
      }
    }
  });

  it('refuses a form with no weekday ticked, with the recurring path message', () => {
    const parsed = specificDaysForm(form(base));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({ fieldErrors: { weekdays: 'Tick at least one day of the week.' } });
    }
  });

  it('requires Starts and Ends, with the same message the single class uses', () => {
    const parsed = specificDaysForm(form({ ...base, startsAt: '', endsAt: '', weekdays: ['1'] }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({
        fieldErrors: { startsAt: 'Enter a date and time.', endsAt: 'Enter a date and time.' },
      });
    }
  });

  it('refuses a Starts that is not a date and time', () => {
    const parsed = specificDaysForm(form({ ...base, startsAt: 'soon', weekdays: ['1'] }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({
        fieldErrors: { startsAt: 'That date or time does not exist. Choose another.' },
      });
    }
  });
});
