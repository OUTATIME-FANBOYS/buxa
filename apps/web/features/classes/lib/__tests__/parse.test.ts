import { describe, expect, it } from 'vitest';
import { classForm, cancelForm, enrolForm, numberField, sessionForm } from '../parse';
import { WHOLE_NUMBER } from '../copy';

function formOf(values: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return form;
}

const VALID_CLASS = { name: 'Robotics', description: '', minAge: '8', maxAge: '12', capacity: '12', ratioInstructors: '', ratioCampers: '' };

describe('numberField', () => {
  it('reads whole numbers, leaves blanks undefined, and refuses anything else against the field', () => {
    const problems: Record<string, string> = {};
    expect(numberField(formOf({ n: ' 12 ' }), 'n', problems)).toBe(12);
    expect(numberField(formOf({ n: '' }), 'n', problems)).toBeUndefined();
    expect(numberField(formOf({ n: '12.5' }), 'n', problems)).toBeUndefined();
    expect(problems).toEqual({ n: WHOLE_NUMBER });
  });

  it('asks for a required field in plain words when it is blank', () => {
    const problems: Record<string, string> = {};
    numberField(formOf({}), 'minAge', problems, 'Enter the youngest age.');
    expect(problems).toEqual({ minAge: 'Enter the youngest age.' });
  });
});

describe('classForm', () => {
  it('builds the contract input, with no instructor ratio when both ratio fields are blank', () => {
    const parsed = classForm(formOf(VALID_CLASS));
    expect(parsed).toMatchObject({ ok: true, data: { name: 'Robotics', ageRange: { minAge: 8, maxAge: 12 }, capacity: 12, instructorRatio: null } });
  });

  it('keeps an instructor ratio when both numbers are given', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, ratioInstructors: '1', ratioCampers: '8' }));
    expect(parsed).toMatchObject({ ok: true, data: { instructorRatio: { instructors: 1, campers: 8 } } });
  });

  it('names each required field that is blank, and the ratio that is only half given', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, minAge: '', maxAge: '', capacity: '', ratioInstructors: '1' }));
    expect(parsed).toMatchObject({
      ok: false,
      state: { status: 'error', fieldErrors: {
        minAge: 'Enter the youngest age.', maxAge: 'Enter the oldest age.', capacity: 'Enter the default number of places.',
        ratioCampers: 'Give both numbers of the ratio, or leave both empty.',
      } },
    });
  });

  it('shows the reversed age range on the oldest-age field, with the contract message', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, minAge: '14', maxAge: '6' }));
    expect(parsed).toMatchObject({ ok: false, state: { fieldErrors: { maxAge: 'The youngest age cannot be above the oldest.' } } });
  });

  it('refuses a missing class name with the contract message', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, name: '   ' }));
    expect(parsed).toMatchObject({ ok: false, state: { fieldErrors: { name: 'Give the class a name.' } } });
  });
});

describe('sessionForm', () => {
  const base = {
    startsAt: '2027-07-05T09:00', endsAt: '2027-07-05T12:00', location: 'Lab 1', capacity: '', instructorIds: [],
  };

  it('converts the camp clock to an instant in the camp zone (Sydney is UTC+10 in July)', () => {
    const parsed = sessionForm(formOf(base), 'Australia/Sydney');
    expect(parsed).toMatchObject({ ok: true, data: { startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z', capacity: undefined } });
  });

  it('refuses a time with an offset, and a time that does not exist, against the start field', () => {
    const offset = sessionForm(formOf({ ...base, startsAt: '2027-07-05T09:00+10:00' }), 'Australia/Sydney');
    expect(offset).toMatchObject({ ok: false, state: { fieldErrors: { startsAt: 'Leave off the time zone. Times are in the camp\'s time zone.' } } });
    const missing = sessionForm(formOf({ ...base, endsAt: '2027-02-30T10:00' }), 'Australia/Sydney');
    expect(missing).toMatchObject({ ok: false, state: { fieldErrors: { endsAt: 'That date or time does not exist.' } } });
  });

  it('refuses a session that ends before it starts, on the end field', () => {
    const parsed = sessionForm(formOf({ ...base, endsAt: '2027-07-05T08:00' }), 'Australia/Sydney');
    expect(parsed).toMatchObject({ ok: false, state: { fieldErrors: { endsAt: 'The session must end after it starts.' } } });
  });

  it('keeps the instructor ids and an explicit capacity', () => {
    const id = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';
    const parsed = sessionForm(formOf({ ...base, capacity: '6', instructorIds: [id] }), 'Australia/Sydney');
    expect(parsed).toMatchObject({ ok: true, data: { capacity: 6, instructorIds: [id] } });
  });
});

describe('enrolForm', () => {
  const session = '11111111-1111-4111-8111-111111111111';
  const camper = '22222222-2222-4222-8222-222222222222';

  it('sends the waitlist choice only for the waitlist button', () => {
    expect(enrolForm(formOf({ sessionId: session, camperId: camper, intent: 'waitlist' }))).toMatchObject({ ok: true, data: { waitlistIfFull: true } });
    expect(enrolForm(formOf({ sessionId: session, camperId: camper, intent: 'enrol' }))).toMatchObject({ ok: true, data: { waitlistIfFull: false } });
  });

  it('adds an override only when a reason was typed', () => {
    const blank = enrolForm(formOf({ sessionId: session, camperId: camper, overrideReason: '  ' }));
    expect(blank.ok && 'override' in blank.data).toBe(false);
    expect(enrolForm(formOf({ sessionId: session, camperId: camper, overrideReason: 'Sibling pickup' })))
      .toMatchObject({ ok: true, data: { override: { reason: 'Sibling pickup' } } });
  });

  it('asks for a camper before anything else', () => {
    expect(enrolForm(formOf({ sessionId: session, camperId: '' }))).toMatchObject({ ok: false, state: { fieldErrors: { camperId: 'Choose a camper.' } } });
  });
});

describe('cancelForm', () => {
  it('needs an enrolment id and keeps an optional note', () => {
    const id = '33333333-3333-4333-8333-333333333333';
    expect(cancelForm(formOf({ enrolmentId: id, note: 'Moved to another camp' }))).toMatchObject({ ok: true, data: { note: 'Moved to another camp' } });
    expect(cancelForm(formOf({ enrolmentId: '' }))).toMatchObject({ ok: false });
  });
});
