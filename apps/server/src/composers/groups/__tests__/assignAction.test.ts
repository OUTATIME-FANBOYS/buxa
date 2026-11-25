import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle, type Role } from '@buxa/domain';
import type { AssignInput } from '@buxa/contracts';
import { idle, ratioKey, refusedKey, RATIO_REFUSAL_KEY } from '@buxa/shared';
import { forbidden } from '../../../http/errors';

// The assign action end to end, without a database: the service's outcome becomes the form's state. The form may name several
// people, one group and one room; each person is placed on its own, so a refusal for one does not undo the others. A refusal names
// the person and the reason. A ratio refusal carries the key the Assign pop-up reads to offer the admin's override.
const services = vi.hoisted(() => ({
  groups: { assign: vi.fn(), listGroups: vi.fn(), listRooms: vi.fn(), listAssignments: vi.fn() },
  classes: { getSession: vi.fn() },
  people: { list: vi.fn() },
}));
const session = vi.hoisted<{ role: Role | null }>(() => ({ role: 'staff' }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { assignAction } = await import('../assignAction');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const ADA = '22222222-2222-4222-8222-222222222222';
const GRACE = '33333333-3333-4333-8333-333333333333';
const GROUP_ID = '44444444-4444-4444-8444-444444444444';
const ROOM_ID = '55555555-5555-4555-8555-555555555555';

function placeForm(personIds: string[] = [ADA], extra: Record<string, string> = {}): FormData {
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

/** The names the refusal message uses come from the session's people, read the same way the Assign page reads them. */
function givePeopleNames(): void {
  services.classes.getSession.mockResolvedValue({ ok: true, value: { id: SESSION_ID, name: 'Summer 1' } });
  services.groups.listGroups.mockResolvedValue({ ok: true, value: [] });
  services.groups.listRooms.mockResolvedValue({ ok: true, value: [] });
  services.groups.listAssignments.mockResolvedValue({ ok: true, value: [] });
  services.people.list.mockImplementation((_actor: unknown, query: { role: string }) =>
    Promise.resolve(
      query.role === 'camper'
        ? [
            { id: ADA, givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] },
            { id: GRACE, givenName: 'Grace', familyName: 'Hopper', roles: ['camper'] },
          ]
        : [],
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.role = 'staff';
  givePeopleNames();
});

describe('assignAction', () => {
  it('places a person and reports the success in plain words', async () => {
    services.groups.assign.mockResolvedValue({ ok: true, value: { personName: 'Ada Lovelace' } });

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({ status: 'success', message: 'Ada Lovelace is placed.' });
  });

  it('places two campers in one go, each with the same group and room', async () => {
    services.groups.assign.mockResolvedValueOnce({ ok: true, value: { personName: 'Ada Lovelace' } });
    services.groups.assign.mockResolvedValueOnce({ ok: true, value: { personName: 'Grace Hopper' } });

    const state = await assignAction(idle, placeForm([ADA, GRACE]));

    expect(services.groups.assign).toHaveBeenCalledTimes(2);
    for (const [, input] of services.groups.assign.mock.calls) {
      expect(input).toMatchObject({ groupId: GROUP_ID, roomId: ROOM_ID, role: 'camper' });
    }
    expect(services.groups.assign.mock.calls.map(call => (call[1] as AssignInput).personId)).toEqual([ADA, GRACE]);
    expect(state).toEqual({ status: 'success', message: '2 people are placed.' });
  });

  it('keeps the people who were placed when one is refused, and names the refused person and reason', async () => {
    services.groups.assign.mockResolvedValueOnce({ ok: true, value: { personName: 'Ada Lovelace' } });
    services.groups.assign.mockResolvedValueOnce({
      ok: false,
      failure: { reason: 'group_full', message: 'This group is full (4 campers).' },
    });

    const state = await assignAction(idle, placeForm([ADA, GRACE]));

    expect(services.groups.assign).toHaveBeenCalledTimes(2);
    expect(state).toEqual({
      status: 'error',
      message: '1 placed. Grace Hopper: This group is full (4 campers).',
      fieldErrors: { [refusedKey(GRACE)]: 'This group is full (4 campers).' },
    });
  });

  it('shows a ratio refusal under the form and marks it for the override pop-up', async () => {
    services.groups.assign.mockResolvedValue({
      ok: false,
      failure: { reason: 'ratio', message: 'This group would have 5 campers for 1 staff.' },
    });

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({
      status: 'error',
      message: 'This group would have 5 campers for 1 staff.',
      fieldErrors: {
        [RATIO_REFUSAL_KEY]: 'This group would have 5 campers for 1 staff.',
        [refusedKey(ADA)]: 'This group would have 5 campers for 1 staff.',
        [ratioKey(ADA)]: 'This group would have 5 campers for 1 staff.',
      },
    });
  });

  it('shows any other refusal as a message with no override offered', async () => {
    services.groups.assign.mockResolvedValue({
      ok: false,
      failure: { reason: 'group_full', message: 'This group is full (4 campers).' },
    });

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({
      status: 'error',
      message: 'This group is full (4 campers).',
      fieldErrors: { [refusedKey(ADA)]: 'This group is full (4 campers).' },
    });
  });

  it('passes an override reason to the service, from the override pop-up', async () => {
    services.groups.assign.mockResolvedValue({ ok: true, value: { personName: 'Ada Lovelace' } });

    await assignAction(idle, placeForm([ADA], { overrideReason: '  Staff on the way  ' }));

    expect(services.groups.assign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ override: { reason: 'Staff on the way' }, role: 'camper' }),
    );
  });

  it('turns a 403 from the service (a viewer placing someone) into a form message, not a crash', async () => {
    session.role = 'viewer';
    services.groups.assign.mockRejectedValue(forbidden('Your role cannot do this'));

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({ status: 'error', message: 'Your role cannot do this.' });
  });
});
