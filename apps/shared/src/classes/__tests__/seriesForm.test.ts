import { describe, expect, it } from 'vitest';
import { planSeries } from '@buxa/domain';
import { seriesForm, seriesNameForm } from '../parse';

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

const MONDAY_TO_FRIDAY = ['1', '2', '3', '4', '5'];

describe('seriesForm: one series from the New class form', () => {
  it('reads the chosen weekdays and the Starts and Ends date-times as typed', () => {
    const parsed = seriesForm(form({ ...base, weekdays: MONDAY_TO_FRIDAY }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toMatchObject({
        name: 'Swimming',
        weekdays: [1, 2, 3, 4, 5],
        startsAt: '2027-07-05T09:00',
        endsAt: '2027-07-30T10:30',
      });
    }
  });

  it('plans one series: each chosen weekday between the two date-times, and no other day', () => {
    const parsed = seriesForm(form({ ...base, weekdays: ['2', '4'] }));
    if (!parsed.ok) {
      throw new Error('expected the form to parse');
    }
    const plan = planSeries(
      { weekdays: parsed.data.weekdays, startsLocal: parsed.data.startsAt, endsLocal: parsed.data.endsAt },
      'Australia/Sydney',
    );

    expect(plan.ok).toBe(true);
    if (plan.ok) {
      const weekdays = plan.series.occurrences.map(o => new Date(`${o.date}T12:00:00Z`).getUTCDay());
      expect(weekdays.length).toBeGreaterThan(0);
      expect(weekdays.every(d => d === 2 || d === 4)).toBe(true);
      expect(plan.series.occurrences.every(o => o.date >= '2027-07-05' && o.date <= '2027-07-30')).toBe(true);
    }
  });

  it('refuses a form with no weekday ticked', () => {
    const parsed = seriesForm(form(base));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({ fieldErrors: { weekdays: 'Tick at least one day of the week.' } });
    }
  });

  it('requires Starts and Ends', () => {
    const parsed = seriesForm(form({ ...base, startsAt: '', endsAt: '', weekdays: ['1'] }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({
        fieldErrors: { startsAt: 'Enter a date and time.', endsAt: 'Enter a date and time.' },
      });
    }
  });

  it('refuses a Starts that is not a date and time', () => {
    const parsed = seriesForm(form({ ...base, startsAt: 'soon', weekdays: ['1'] }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({
        fieldErrors: { startsAt: 'That date or time does not exist. Choose another.' },
      });
    }
  });
});

describe('seriesNameForm: a teacher edits the name of a series, and the rest is kept as saved', () => {
  const saved = {
    name: 'Swimming',
    ageRange: { minAge: 8, maxAge: 12 },
    capacity: 20,
    location: 'Pool',
    instructorIds: [],
    price: null,
    weekdays: [1, 3],
    startsAt: '2027-07-05T09:00',
    endsAt: '2027-07-30T10:30',
  };

  it('takes the new name and keeps every other field as it is saved', () => {
    const parsed = seriesNameForm(form({ name: 'Diving', detailsOnly: 'yes' }), saved);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual({ ...saved, name: 'Diving' });
    }
  });

  it('refuses a blank name, with the message the new-class name field shows', () => {
    const parsed = seriesNameForm(form({ name: '  ' }), saved);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({ fieldErrors: { name: 'Enter a name.' } });
    }
  });
});
