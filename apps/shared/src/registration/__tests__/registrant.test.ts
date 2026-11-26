import { describe, expect, it } from 'vitest';
import {
  CAMPER_BIRTH_DATE_MISSING,
  CAMPER_DETAILS_ON_PERSON,
  PARENT_DETAILS_ON_PERSON,
  parentOnFile,
  splitName,
  standardAnswers,
  type CamperRecord,
} from '../registrant';

const CAMPER: CamperRecord = {
  id: '7d6c5b4a-3210-4f9e-8d7c-6b5a49382716',
  name: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  dateOfBirth: '2014-03-09',
  parent: null,
};

const ON_FILE = { name: 'Byron Lovelace', email: 'byron@example.test', phone: '555-0100', dateOfBirth: '1979-11-02' };
/** A parent on file (a phone recorded) with no date of birth: the form asks for it. */
const ON_FILE_NO_BIRTH = { ...ON_FILE, dateOfBirth: null };

/** What the form posts for a child whose parent is not on file yet: the camper's details and the parent the family types. */
const posted = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianEmail: 'byron@example.test',
  guardianPhone: '555-0100',
};

describe('parentOnFile', () => {
  it('is false with no parent, and with a parent who has no phone', () => {
    expect(parentOnFile(null)).toBe(false);
    expect(parentOnFile({ name: 'Byron Lovelace', email: null, phone: null, dateOfBirth: null })).toBe(false);
    expect(parentOnFile({ name: 'Byron Lovelace', email: null, phone: '   ', dateOfBirth: null })).toBe(false);
  });

  it('is true when the parent has a phone number', () => {
    expect(parentOnFile(ON_FILE)).toBe(true);
  });
});

describe('splitName', () => {
  it('splits a first word from the rest', () => {
    expect(splitName('Byron Lovelace')).toEqual({ givenName: 'Byron', familyName: 'Lovelace' });
    expect(splitName('  Ana   Maria Lopez ')).toEqual({ givenName: 'Ana', familyName: 'Maria Lopez' });
  });

  it('is null when there is no last name', () => {
    expect(splitName('Ana')).toBeNull();
    expect(splitName('   ')).toBeNull();
    expect(splitName('Ana ')).toBeNull();
  });
});

describe('standardAnswers', () => {
  it('stores the camper from the record when the posted camper matches it', () => {
    const { standard, errors } = standardAnswers(posted, CAMPER);
    expect(errors).toEqual({});
    expect(standard).toMatchObject({
      camperFirstName: 'Ada',
      camperLastName: 'Lovelace',
      camperBirthDate: '2014-03-09',
    });
  });

  it('refuses a posted camper name that differs from the record, and stores nothing different', () => {
    const { errors } = standardAnswers({ ...posted, camperFirstName: 'Grace' }, CAMPER);
    expect(errors).toEqual({ 'standard.camperFirstName': CAMPER_DETAILS_ON_PERSON });
  });

  it('refuses a posted date of birth that differs from the record', () => {
    const { errors, standard } = standardAnswers({ ...posted, camperBirthDate: '2010-01-01' }, CAMPER);
    expect(errors).toEqual({ 'standard.camperBirthDate': CAMPER_DETAILS_ON_PERSON });
    expect(standard.camperBirthDate).toBe('2014-03-09');
  });

  it('asks for the date of birth on the person page when the record has none', () => {
    const { errors } = standardAnswers(posted, { ...CAMPER, dateOfBirth: null });
    expect(errors).toEqual({ 'standard.camperBirthDate': CAMPER_BIRTH_DATE_MISSING });
  });

  it('uses the parent on file in place of the posted parent, and reads no parent that is not on file', () => {
    const onFile = standardAnswers(
      { ...posted, guardianName: 'Someone Else', guardianPhone: '000' },
      {
        ...CAMPER,
        parent: ON_FILE,
      },
    );
    expect(onFile.standard).toMatchObject({
      guardianName: 'Byron Lovelace',
      guardianEmail: 'byron@example.test',
      guardianPhone: '555-0100',
    });

    const notOnFile = standardAnswers(posted, {
      ...CAMPER,
      parent: { name: 'Byron Lovelace', email: null, phone: null, dateOfBirth: null },
    });
    expect(notOnFile.standard).toMatchObject({ guardianName: 'Byron Lovelace', guardianPhone: '555-0100' });
  });

  it('stores the posted parent date of birth when the parent is not on file, and asks for it (blank is left for the schema)', () => {
    const typed = standardAnswers({ ...posted, guardianDateOfBirth: '1979-11-02' }, CAMPER);
    expect(typed.errors).toEqual({});
    expect(typed.standard.guardianDateOfBirth).toBe('1979-11-02');

    const blank = standardAnswers(posted, CAMPER);
    expect(blank.errors).toEqual({});
    expect(blank.standard.guardianDateOfBirth).toBeUndefined();
  });

  it("fills the parent's date of birth from the record when it is on file, and refuses a different one", () => {
    const onFile = standardAnswers({ ...posted, guardianDateOfBirth: '1990-01-01' }, { ...CAMPER, parent: ON_FILE });
    expect(onFile.errors).toEqual({ 'standard.guardianDateOfBirth': PARENT_DETAILS_ON_PERSON });
    expect(onFile.standard.guardianDateOfBirth).toBe('1979-11-02');
  });

  it('keeps the parent date of birth as a posted answer when the parent is on file without one', () => {
    const { standard, errors } = standardAnswers(
      { ...posted, guardianDateOfBirth: '1979-11-02' },
      { ...CAMPER, parent: ON_FILE_NO_BIRTH },
    );
    expect(errors).toEqual({});
    expect(standard.guardianDateOfBirth).toBe('1979-11-02');
    expect(standard).toMatchObject({ guardianName: 'Byron Lovelace', guardianPhone: '555-0100' });
  });
});
