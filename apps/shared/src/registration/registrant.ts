/*
 * The child and the parent or guardian a registration is recorded for, as the server reads them from the person record. The form
 * shows them (read only when they are on file) and the server checks what was posted against them. Pure: no database, no React.
 */

/**
 * A parent or guardian on the child's household, from the person record. Email, phone and date of birth are null when none is
 * recorded. A phone is required on every person, and so is a date of birth; a record saved before that rule can lack either.
 */
export interface ParentDetails {
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
}

/** A child (a person with the camper role) and the parent or guardian on file. `dateOfBirth` is null when none is recorded. */
export interface CamperRecord {
  id: string;
  name: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string | null;
  parent: ParentDetails | null;
}

/** The camper's name and date of birth come from the person's page, so the registration never changes them. */
export const CAMPER_DETAILS_ON_PERSON =
  "The camper's name and date of birth are on the person's page. Change them there.";
/** A registration needs the child's date of birth, and it is set on the person, not here. */
export const CAMPER_BIRTH_DATE_MISSING = "Add the date of birth on the person's page first.";
/** The parent's name, email, phone and date of birth come from the person's page once they are on file. */
export const PARENT_DETAILS_ON_PERSON = "The parent or guardian's details are on the person's page. Change them there.";
/** Saving the parent or guardian needs a first and a last name, since the person record keeps them apart. */
export const PARENT_NAME_NEEDS_TWO_WORDS = 'Enter the first and the last name.';

/**
 * The parent or guardian is on file when the household has one with a phone number. Until then the form asks for the details and
 * the server saves them to the household when the registration is recorded. A parent on file with no date of birth still asks
 * for it, and the server saves it to the person.
 */
export function parentOnFile(parent: ParentDetails | null): boolean {
  return parent !== null && (parent.phone ?? '').trim() !== '';
}

/** A typed name split into a first and a last name: the first word, then the rest. Null when there is no last name. */
export function splitName(name: string): { givenName: string; familyName: string } | null {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  if (space <= 0 || space === trimmed.length - 1) {
    return null;
  }

  return { givenName: trimmed.slice(0, space), familyName: trimmed.slice(space + 1) };
}

/** The result of checking a posted registration against the child's record. */
export interface StandardAnswers {
  /** The standard answers to store: the child's fields from the record, and the parent's from the record when on file. */
  standard: Record<string, string>;
  /** Field messages keyed `standard.<key>`, for a posted camper value that differs from the record. */
  errors: Record<string, string>;
}

/** Whether a posted camper value matches the record (a blank one is simply not sent, and is filled from the record). */
function matchesRecord(posted: string | undefined, known: string): boolean {
  const typed = (posted ?? '').trim();

  return typed === '' || typed === known;
}

/**
 * The standard answers for one child. The camper's name and date of birth are always the record's: a posted value that differs is
 * refused, not stored. When the parent or guardian is on file, their name, email, phone and (when recorded) date of birth are the
 * record's too. Otherwise the posted parent answers stand, and the server saves them after the registration is recorded.
 */
export function standardAnswers(posted: Readonly<Record<string, string>>, camper: CamperRecord): StandardAnswers {
  const errors: Record<string, string> = {};
  const standard: Record<string, string> = { ...posted };

  if (
    !matchesRecord(posted.camperFirstName, camper.givenName) ||
    !matchesRecord(posted.camperLastName, camper.familyName)
  ) {
    errors['standard.camperFirstName'] = CAMPER_DETAILS_ON_PERSON;
  }
  standard.camperFirstName = camper.givenName;
  standard.camperLastName = camper.familyName;

  if (camper.dateOfBirth === null) {
    errors['standard.camperBirthDate'] = CAMPER_BIRTH_DATE_MISSING;
    standard.camperBirthDate = '';
  } else {
    if (!matchesRecord(posted.camperBirthDate, camper.dateOfBirth)) {
      errors['standard.camperBirthDate'] = CAMPER_DETAILS_ON_PERSON;
    }
    standard.camperBirthDate = camper.dateOfBirth;
  }

  if (camper.parent !== null && parentOnFile(camper.parent)) {
    standard.guardianName = camper.parent.name;
    standard.guardianEmail = camper.parent.email ?? '';
    standard.guardianPhone = camper.parent.phone ?? '';
    if (camper.parent.dateOfBirth !== null) {
      if (!matchesRecord(posted.guardianDateOfBirth, camper.parent.dateOfBirth)) {
        errors['standard.guardianDateOfBirth'] = PARENT_DETAILS_ON_PERSON;
      }
      standard.guardianDateOfBirth = camper.parent.dateOfBirth;
    }
    // Without a date of birth on file, the posted one stands: the server saves it to the parent's person record.
  }

  return { standard, errors };
}
