import { describe, expect, it } from 'vitest';
import { recurringClassForm } from '../parse';

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
  firstDate: '2027-07-05',
  startTime: '09:00',
  endTime: '10:30',
  endKind: 'until',
  endDate: '2027-08-30',
};

describe('recurringClassForm', () => {
  it('reads the ticked weekdays and an end date into a weekly rule', () => {
    const parsed = recurringClassForm(form({ ...base, weekdays: ['1', '3'] }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.rule).toEqual({
        weekdays: [1, 3],
        firstDate: '2027-07-05',
        startTime: '09:00',
        endTime: '10:30',
        end: { kind: 'until', date: '2027-08-30' },
      });
    }
  });

  it('reads a number of classes when that end is chosen', () => {
    const parsed = recurringClassForm(form({ ...base, weekdays: ['2'], endKind: 'count', endCount: '6' }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.rule.end).toEqual({ kind: 'count', count: 6 });
    }
  });

  it('asks for at least one day of the week, and names the field', () => {
    const parsed = recurringClassForm(form({ ...base }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state).toMatchObject({ fieldErrors: { weekdays: 'Tick at least one day of the week.' } });
    }
  });
});
