import {
  AssignInputSchema,
  GroupInputSchema,
  RoomInputSchema,
  type AssignInput,
  type GroupInput,
  type RoomInput,
} from '@buxa/contracts';
import { failure, type FieldErrors } from '../actionState';
import { field, parseWith, type PersonParsed } from '../people/parse';
import { WHOLE_NUMBER } from '../classes/copy';

/*
 * Turns the posted fields of the group, room and assign forms into the contract's inputs. Blank or non-numeric numbers are named
 * against their field first; the contract's own messages cover the rest. The age range and ratio are optional: a blank one means none.
 */

const CHECK = 'Check the highlighted fields.';

/** The field key a ratio refusal is reported under. The assign form reads it to offer the admin's override in a pop-up. */
export const RATIO_REFUSAL_KEY = 'ratio';

/** An optional whole number: blank is null; text that is not a whole number is reported against the field. */
function optionalNumber(form: FormData, name: string, problems: FieldErrors): number | null {
  const raw = field(form, name).trim();
  if (raw === '') {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    problems[name] = WHOLE_NUMBER;

    return null;
  }

  return Number(raw);
}

/** A required whole number: blank or not a number is reported against the field. */
function requiredNumber(form: FormData, name: string, problems: FieldErrors, message: string): number | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    problems[name] = message;

    return undefined;
  }
  if (!/^\d+$/.test(raw)) {
    problems[name] = WHOLE_NUMBER;

    return undefined;
  }

  return Number(raw);
}

/** Merges the form's own problems with the contract's, then returns the parsed value or the failure. */
function finish<T>(problems: FieldErrors, parsed: PersonParsed<T>): PersonParsed<T> {
  if (Object.keys(problems).length > 0) {
    return { ok: false, state: failure(CHECK, problems) };
  }

  return parsed;
}

/** A group: its name, capacity, ratio (campers per staff) and optional age range. */
export function groupForm(form: FormData): PersonParsed<GroupInput> {
  const problems: FieldErrors = {};
  const capacity = requiredNumber(form, 'capacity', problems, 'Enter a capacity.');
  const ratio = optionalNumber(form, 'ratioCampers', problems);
  const minAge = optionalNumber(form, 'ageMin', problems);
  const maxAge = optionalNumber(form, 'ageMax', problems);
  const ageRange = minAge !== null || maxAge !== null ? { minAge: minAge ?? 0, maxAge: maxAge ?? 120 } : null;

  return finish(
    problems,
    parseWith<GroupInput>(GroupInputSchema, { name: field(form, 'name'), capacity, ratioCampers: ratio, ageRange }),
  );
}

/** A room: its name, location and capacity for this session. */
export function roomForm(form: FormData): PersonParsed<RoomInput> {
  const problems: FieldErrors = {};
  const capacity = requiredNumber(form, 'capacity', problems, 'Enter a capacity.');

  return finish(
    problems,
    parseWith<RoomInput>(RoomInputSchema, { name: field(form, 'name'), location: field(form, 'location'), capacity }),
  );
}

/** An assignment: the session, person, role, group and room, with an optional ratio override reason. */
export function assignForm(form: FormData): PersonParsed<AssignInput> {
  const reason = field(form, 'overrideReason').trim();

  return parseWith<AssignInput>(AssignInputSchema, {
    sessionId: field(form, 'sessionId'),
    personId: field(form, 'personId'),
    role: field(form, 'role'),
    groupId: field(form, 'groupId'),
    roomId: field(form, 'roomId'),
    ...(reason ? { override: { reason } } : {}),
  });
}
