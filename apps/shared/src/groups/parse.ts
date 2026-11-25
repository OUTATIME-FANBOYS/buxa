import {
  AssignInputSchema,
  GroupInputSchema,
  RoomInputSchema,
  UnassignInputSchema,
  type AssignInput,
  type GroupInput,
  type RoomInput,
  type UnassignInput,
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

/** The field key a refusal for one person is reported under: `refused:<personId>`, with the reason as its message. */
export const REFUSED_KEY_PREFIX = 'refused:';
/** The field key a ratio refusal for one person is reported under: `ratio:<personId>`. The override pop-up posts those people again. */
export const RATIO_KEY_PREFIX = 'ratio:';

export const refusedKey = (personId: string): string => `${REFUSED_KEY_PREFIX}${personId}`;
export const ratioKey = (personId: string): string => `${RATIO_KEY_PREFIX}${personId}`;

/** The people a failed placement refused, from its field errors. */
export function refusedPersonIds(fieldErrors: FieldErrors | undefined): string[] {
  return personIdsWithPrefix(fieldErrors, REFUSED_KEY_PREFIX);
}

/** The people a failed placement refused for the staff ratio: the ones an admin can place with an override. */
export function ratioPersonIds(fieldErrors: FieldErrors | undefined): string[] {
  return personIdsWithPrefix(fieldErrors, RATIO_KEY_PREFIX);
}

function personIdsWithPrefix(fieldErrors: FieldErrors | undefined, prefix: string): string[] {
  return Object.keys(fieldErrors ?? {})
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length));
}

/**
 * The placements a form asks for: one per chosen person (the `personId` fields), all in the same group and room, with the same role
 * and the optional ratio override reason. Each one is checked on its own by the service. A repeated person counts once.
 */
export function assignInputsForm(form: FormData): PersonParsed<AssignInput[]> {
  const reason = field(form, 'overrideReason').trim();
  const personIds = [
    ...new Set(
      form
        .getAll('personId')
        .flatMap(value => (typeof value === 'string' && value.trim() !== '' ? [value.trim()] : [])),
    ),
  ];
  if (personIds.length === 0) {
    return { ok: false, state: failure('Choose a person.', { personId: 'Choose a person.' }) };
  }

  const inputs: AssignInput[] = [];
  for (const personId of personIds) {
    const parsed = parseWith<AssignInput>(AssignInputSchema, {
      sessionId: field(form, 'sessionId'),
      personId,
      role: field(form, 'role'),
      groupId: field(form, 'groupId'),
      roomId: field(form, 'roomId'),
      ...(reason ? { override: { reason } } : {}),
    });
    if (!parsed.ok) {
      return parsed;
    }
    inputs.push(parsed.data);
  }

  return { ok: true, data: inputs };
}

/** An unassign: the session and the person. The group and room come from the person's placement. */
export function unassignForm(form: FormData): PersonParsed<UnassignInput> {
  return parseWith<UnassignInput>(UnassignInputSchema, {
    sessionId: field(form, 'sessionId'),
    personId: field(form, 'personId'),
  });
}
