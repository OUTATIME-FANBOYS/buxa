import { describe, expect, it } from 'vitest';
import { RegistrationFormInputSchema, buildSubmissionSchema, type CustomField } from './registration';

const SESSION = '3f2b8c1e-5a4d-4b6e-9f70-1a2b3c4d5e6f';
const FORM = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const CAMPER = '7d6c5b4a-3210-4f9e-8d7c-6b5a49382716';
const CLASS = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const fields: CustomField[] = [
  { kind: 'text', key: 'allergies', label: 'Allergies', required: false },
  { kind: 'choice', key: 'swim', label: 'Swim level', required: true, options: ['None', 'Beginner', 'Strong'] },
  { kind: 'date', key: 'start', label: 'Start date', required: true },
  { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true },
];

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianEmail: 'byron@example.test',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

const answers = { swim: 'Beginner', start: '2027-06-14', photos: 'yes' };

describe('registration form input', () => {
  const valid = {
    name: 'Summer 2027',
    sessionIds: [SESSION],
    fields: [{ kind: 'choice', key: 'swim', label: 'Swim level', required: true, options: ['A', 'B'] }],
  };

  it('accepts a form and trims its text', () => {
    const parsed = RegistrationFormInputSchema.parse({ ...valid, name: '  Summer 2027  ' });
    expect(parsed.name).toBe('Summer 2027');
  });

  it('takes no season: a season sent with the form is dropped', () => {
    expect(RegistrationFormInputSchema.parse(valid)).not.toHaveProperty('season');
  });

  it('needs at least one session', () => {
    expect(RegistrationFormInputSchema.safeParse({ ...valid, sessionIds: [] }).success).toBe(false);
  });

  it('refuses two questions with the same key', () => {
    const dup = { ...valid, fields: [valid.fields[0], valid.fields[0]] };
    expect(RegistrationFormInputSchema.safeParse(dup).success).toBe(false);
  });

  it('refuses a choice with fewer than two options or repeated options', () => {
    const one = { ...valid, fields: [{ ...valid.fields[0], options: ['A'] }] };
    const same = { ...valid, fields: [{ ...valid.fields[0], options: ['A', 'A'] }] };
    expect(RegistrationFormInputSchema.safeParse(one).success).toBe(false);
    expect(RegistrationFormInputSchema.safeParse(same).success).toBe(false);
  });

  it('refuses a key with capitals, spaces or a leading digit', () => {
    for (const key of ['Swim', 'swim level', '1swim']) {
      const bad = { ...valid, fields: [{ ...valid.fields[0], key }] };
      expect(RegistrationFormInputSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('refuses an unknown field kind', () => {
    const bad = { ...valid, fields: [{ kind: 'money', key: 'fee', label: 'Fee', required: true }] };
    expect(RegistrationFormInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('submission schema built from a form version', () => {
  const schema = buildSubmissionSchema(fields);
  const submission = { formId: FORM, selections: [{ camperId: CAMPER, classId: CLASS }], standard, custom: answers };

  it('accepts a complete submission', () => {
    expect(schema.safeParse(submission).success).toBe(true);
  });

  it('leaves out an optional answer that is blank', () => {
    const parsed = schema.parse({ ...submission, custom: { ...answers, allergies: '   ' } });
    expect(parsed.custom.allergies).toBeUndefined();
  });

  it('refuses a missing required standard field', () => {
    const r = schema.safeParse({ ...submission, standard: { ...standard, guardianPhone: '' } });
    expect(r.success).toBe(false);
  });

  it('accepts an optional guardian email left blank, and refuses a malformed one', () => {
    expect(schema.safeParse({ ...submission, standard: { ...standard, guardianEmail: '' } }).success).toBe(true);
    expect(schema.safeParse({ ...submission, standard: { ...standard, guardianEmail: 'nope' } }).success).toBe(false);
  });

  it('refuses a choice that is not one of its options', () => {
    expect(schema.safeParse({ ...submission, custom: { ...answers, swim: 'Expert' } }).success).toBe(false);
  });

  it('refuses a date that does not exist', () => {
    expect(schema.safeParse({ ...submission, custom: { ...answers, start: '2027-02-30' } }).success).toBe(false);
  });

  it('refuses a required yes/no left unanswered', () => {
    expect(schema.safeParse({ ...submission, custom: { ...answers, photos: '' } }).success).toBe(false);
  });

  it('turns yes and no into booleans', () => {
    expect(schema.parse({ ...submission, custom: { ...answers, photos: 'no' } }).custom.photos).toBe(false);
    expect(schema.parse({ ...submission, custom: { ...answers, photos: true } }).custom.photos).toBe(true);
  });

  it('needs at least one class selection and a form id', () => {
    expect(schema.safeParse({ ...submission, selections: [] }).success).toBe(false);
    expect(schema.safeParse({ ...submission, selections: [{ camperId: 'x', classId: CLASS }] }).success).toBe(false);
    expect(schema.safeParse({ ...submission, formId: 'not-a-uuid' }).success).toBe(false);
  });
});
