import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle, type Role } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { forbidden } from '../../../http/errors';

// The assign action end to end, without a database: the service's outcome becomes the form's state. A ratio refusal carries the key
// the Assign pop-up reads to offer the admin's override; a viewer is refused as a role, not as a form error.
const services = vi.hoisted(() => ({ groups: { assign: vi.fn() } }));
const session = vi.hoisted<{ role: Role | null }>(() => ({ role: 'staff' }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { assignAction } = await import('../assignAction');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = '33333333-3333-4333-8333-333333333333';
const ROOM_ID = '44444444-4444-4444-8444-444444444444';

function placeForm(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields = {
    sessionId: SESSION_ID,
    personId: PERSON_ID,
    role: 'camper',
    groupId: GROUP_ID,
    roomId: ROOM_ID,
    ...extra,
  };
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }

  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.role = 'staff';
});

describe('assignAction', () => {
  it('places a person and reports the success in plain words', async () => {
    services.groups.assign.mockResolvedValue({ ok: true, value: { personName: 'Ada Lovelace' } });

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({ status: 'success', message: 'Ada Lovelace is placed.' });
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
      fieldErrors: { ratio: 'This group would have 5 campers for 1 staff.' },
    });
  });

  it('shows any other refusal as a message with no override offered', async () => {
    services.groups.assign.mockResolvedValue({
      ok: false,
      failure: { reason: 'group_full', message: 'This group is full (4 campers).' },
    });

    const state = await assignAction(idle, placeForm());

    expect(state).toEqual({ status: 'error', message: 'This group is full (4 campers).', fieldErrors: undefined });
  });

  it('passes an override reason to the service, from the override pop-up', async () => {
    services.groups.assign.mockResolvedValue({ ok: true, value: { personName: 'Ada Lovelace' } });

    await assignAction(idle, placeForm({ overrideReason: '  Staff on the way  ' }));

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
