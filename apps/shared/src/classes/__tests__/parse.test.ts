import { describe, expect, it } from 'vitest';
import { classForm, sessionEditForm, sessionForm, cancelForm, enrolForm, numberField } from '../parse';
import { WHOLE_NUMBER } from '../copy';

function formOf(values: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      form.append(name, item);
    }
  }

  return form;
}

const VALID_CLASS = {
  name: 'Robotics',
  minAge: '8',
  maxAge: '12',
  capacity: '12',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
};

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
  it('builds the contract input: its own name, ages, camp size, time range (camp clock) and location', () => {
    const parsed = classForm(formOf(VALID_CLASS));
    expect(parsed).toMatchObject({
      ok: true,
      data: {
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        capacity: 12,
        startsAt: '2027-07-04T23:00:00.000Z',
        endsAt: '2027-07-05T02:00:00.000Z',
        location: 'Lab 1',
        instructorIds: [],
      },
    });
  });

  it('names each required field that is blank', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, minAge: '', maxAge: '', capacity: '' }));
    expect(parsed).toMatchObject({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: {
          minAge: 'Enter the youngest age.',
          maxAge: 'Enter the oldest age.',
          capacity: 'Enter the camp size.',
        },
      },
    });
  });

  it('shows the camp size limit with the contract message, on the camp size field', () => {
    for (const capacity of ['2', '31']) {
      expect(classForm(formOf({ ...VALID_CLASS, capacity }))).toMatchObject({
        ok: false,
        state: {
          fieldErrors: { capacity: 'Camp Size must be a whole number from 3 to 30.' },
        },
      });
    }
  });

  it('shows the reversed age range on the oldest-age field, with the contract message', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, minAge: '14', maxAge: '6' }));
    expect(parsed).toMatchObject({
      ok: false,
      state: { fieldErrors: { maxAge: 'The youngest age cannot be above the oldest.' } },
    });
  });

  it('refuses a local time that is not an instant, and a blank time, against its own field', () => {
    // The browser converts the time it shows; a bare local time reaching the server means it could not be converted.
    const local = classForm(formOf({ ...VALID_CLASS, startsAt: '2027-07-05T09:00' }));
    expect(local).toMatchObject({
      ok: false,
      state: { fieldErrors: { startsAt: 'That date or time does not exist. Choose another.' } },
    });
    const blank = classForm(formOf({ ...VALID_CLASS, endsAt: '' }));
    expect(blank).toMatchObject({
      ok: false,
      state: { fieldErrors: { endsAt: 'Enter a date and time.' } },
    });
  });

  it('refuses a missing class name with the contract message', () => {
    const parsed = classForm(formOf({ ...VALID_CLASS, name: '   ' }));
    expect(parsed).toMatchObject({ ok: false, state: { fieldErrors: { name: 'Enter a name.' } } });
  });
});

describe('sessionForm: the public flag', () => {
  const SESSION = { name: 'Summer', description: '', startsOn: '2027-07-05', endsOn: '2027-07-12' };

  it('reads a ticked Show on the public pages box as public', () => {
    expect(sessionForm(formOf({ ...SESSION, isPublic: 'on' }))).toMatchObject({
      ok: true,
      data: { isPublic: true },
    });
  });

  it('keeps the session private when the box is not ticked, as an unticked box posts nothing', () => {
    expect(sessionForm(formOf(SESSION))).toMatchObject({ ok: true, data: { isPublic: false } });
  });
});

describe('sessionEditForm: the public flag', () => {
  const EDIT = { sessionId: 'x', name: 'Winter', description: '', startsOn: '2027-07-05', endsOn: '2027-07-12' };

  it('saves the public flag from the Edit session dialog when the box is ticked', () => {
    expect(sessionEditForm(formOf({ ...EDIT, isPublic: 'on' }))).toMatchObject({ ok: true, data: { isPublic: true } });
  });

  it('clears the public flag when the box is unticked', () => {
    expect(sessionEditForm(formOf(EDIT))).toMatchObject({ ok: true, data: { isPublic: false } });
  });
});

describe('sessionForm', () => {
  it('builds the session (the parent): name, description and its first and last day', () => {
    expect(
      sessionForm(
        formOf({ name: 'Summer camp', description: 'Two weeks', startsOn: '2027-07-01', endsOn: '2027-07-14' }),
      ),
    ).toMatchObject({
      ok: true,
      data: { name: 'Summer camp', description: 'Two weeks', startsOn: '2027-07-01', endsOn: '2027-07-14' },
    });
  });

  it('asks for the first and last day when they are blank', () => {
    expect(sessionForm(formOf({ name: 'Summer camp', startsOn: '', endsOn: '' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { startsOn: 'Pick a first day.', endsOn: 'Pick a last day.' } },
    });
  });

  it('refuses a session that ends before its first day, on the end field', () => {
    expect(sessionForm(formOf({ name: 'Summer camp', startsOn: '2027-07-10', endsOn: '2027-07-09' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { endsOn: 'The session must end on or after its first day.' } },
    });
  });
});

describe('enrolForm', () => {
  const klass = '11111111-1111-4111-8111-111111111111';
  const camper = '22222222-2222-4222-8222-222222222222';

  it('sends the waitlist choice only for the waitlist button', () => {
    expect(enrolForm(formOf({ classId: klass, camperId: camper, intent: 'waitlist' }))).toMatchObject({
      ok: true,
      data: { classId: klass, waitlistIfFull: true },
    });
    expect(enrolForm(formOf({ classId: klass, camperId: camper, intent: 'enrol' }))).toMatchObject({
      ok: true,
      data: { waitlistIfFull: false },
    });
  });

  it('adds an override only when a reason was typed', () => {
    const blank = enrolForm(formOf({ classId: klass, camperId: camper, overrideReason: '  ' }));
    expect(blank.ok && 'override' in blank.data).toBe(false);
    expect(enrolForm(formOf({ classId: klass, camperId: camper, overrideReason: 'Sibling pickup' }))).toMatchObject({
      ok: true,
      data: { override: { reason: 'Sibling pickup' } },
    });
  });

  it('asks for a camper before anything else', () => {
    expect(enrolForm(formOf({ classId: klass, camperId: '' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { camperId: 'Choose a camper.' } },
    });
  });
});

describe('cancelForm', () => {
  it('needs an enrolment id and keeps an optional note', () => {
    const id = '33333333-3333-4333-8333-333333333333';
    expect(cancelForm(formOf({ enrolmentId: id, note: 'Moved to another camp' }))).toMatchObject({
      ok: true,
      data: { note: 'Moved to another camp' },
    });
    expect(cancelForm(formOf({ enrolmentId: '' }))).toMatchObject({ ok: false });
  });
});
