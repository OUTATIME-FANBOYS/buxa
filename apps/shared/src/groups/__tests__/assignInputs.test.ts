import { describe, expect, it } from 'vitest';
import { assignInputsForm, refusedKey, ratioKey, refusedPersonIds, ratioPersonIds } from '../parse';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const ADA = '22222222-2222-4222-8222-222222222222';
const GRACE = '33333333-3333-4333-8333-333333333333';
const GROUP_ID = '44444444-4444-4444-8444-444444444444';
const ROOM_ID = '55555555-5555-4555-8555-555555555555';

function placeForm(personIds: string[], extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set('sessionId', SESSION_ID);
  form.set('role', 'camper');
  form.set('groupId', GROUP_ID);
  form.set('roomId', ROOM_ID);
  for (const personId of personIds) {
    form.append('personId', personId);
  }
  for (const [name, value] of Object.entries(extra)) {
    form.set(name, value);
  }

  return form;
}

describe('assignInputsForm', () => {
  it('builds one placement per chosen person, all in the same group and room', () => {
    const parsed = assignInputsForm(placeForm([ADA, GRACE]));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.data.map(input => input.personId)).toEqual([ADA, GRACE]);
    for (const input of parsed.data) {
      expect(input).toMatchObject({ sessionId: SESSION_ID, role: 'camper', groupId: GROUP_ID, roomId: ROOM_ID });
    }
  });

  it('keeps one-person placement as a list of one', () => {
    const parsed = assignInputsForm(placeForm([ADA]));

    expect(parsed.ok && parsed.data.length).toBe(1);
  });

  it('counts a person chosen twice once', () => {
    const parsed = assignInputsForm(placeForm([ADA, ADA]));

    expect(parsed.ok && parsed.data.length).toBe(1);
  });

  it('refuses a form with no person, naming the person field', () => {
    const parsed = assignInputsForm(placeForm([]));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.state).toEqual({
      status: 'error',
      message: 'Choose a person.',
      fieldErrors: { personId: 'Choose a person.' },
    });
  });

  it('gives the override reason to every placement, so one reason covers the people who were refused', () => {
    const parsed = assignInputsForm(placeForm([ADA, GRACE], { overrideReason: '  Staff on the way  ' }));

    expect(parsed.ok && parsed.data.map(input => input.override)).toEqual([
      { reason: 'Staff on the way' },
      { reason: 'Staff on the way' },
    ]);
  });
});

describe('refusal keys', () => {
  it('names each refused person and each ratio refusal under its own key', () => {
    const fieldErrors = {
      [refusedKey(ADA)]: 'This group is full (4 campers).',
      [refusedKey(GRACE)]: 'This group would have 5 campers for 1 staff.',
      [ratioKey(GRACE)]: 'This group would have 5 campers for 1 staff.',
    };

    expect(refusedPersonIds(fieldErrors)).toEqual([ADA, GRACE]);
    expect(ratioPersonIds(fieldErrors)).toEqual([GRACE]);
  });

  it('reads no people from a state with no field errors', () => {
    expect(refusedPersonIds(undefined)).toEqual([]);
    expect(ratioPersonIds({ personId: 'Choose a person.' })).toEqual([]);
  });
});
