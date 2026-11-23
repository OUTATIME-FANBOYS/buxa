import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personPath } from '@buxa/shared/config/routes';
import { idle } from '@buxa/shared';
import { conflict, forbidden } from '../../../http/errors';
import { issueBadgeAction } from '../issueBadgeAction';
import { revokeBadgeAction } from '../revokeBadgeAction';
import { formOf, IDS } from './form';
import { settle } from '@buxa/domain';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  credentials: { issue: vi.fn(), revoke: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { credentials: h.credentials } }) }));
vi.mock('../camp', () => ({ currentActor: () => settle(() => h.actor) }));

const SECRET_TOKEN = 'TOKEN-SHOULD-NOT-LEAVE-THE-SERVER';

describe('issueBadgeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    h.credentials.issue.mockResolvedValue({
      credentialId: 'c1',
      token: SECRET_TOKEN,
      payload: 'buxa:badge:payload',
      issuedAt: '2027-07-01T09:00:00Z',
    });
  });

  it('returns success only: no payload and no token, so the code never reaches the browser', async () => {
    const state = await issueBadgeAction(idle, formOf({ personId: IDS.person }));
    expect(state).toEqual({ status: 'success' });
    expect(JSON.stringify(state)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(state)).not.toContain('buxa:badge:payload');
    expect(h.credentials.issue).toHaveBeenCalledWith(h.actor, IDS.person);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('refuses an archived person with the service message', async () => {
    h.credentials.issue.mockRejectedValueOnce(conflict('This person is archived.'));
    expect(await issueBadgeAction(idle, formOf({ personId: IDS.person }))).toEqual({
      status: 'error',
      message: 'This person is archived.',
      fieldErrors: undefined,
    });
  });

  it('turns a 403 (a role without credentials:manage) into a friendly state', async () => {
    h.credentials.issue.mockRejectedValueOnce(forbidden('no'));
    expect(await issueBadgeAction(idle, formOf({ personId: IDS.person }))).toMatchObject({
      status: 'error',
      message: 'Your role cannot do this.',
    });
  });

  it('rejects a person id that is not a UUID before calling the service', async () => {
    expect(await issueBadgeAction(idle, formOf({ personId: 'nope' }))).toMatchObject({ status: 'error' });
    expect(h.credentials.issue).not.toHaveBeenCalled();
  });
});

describe('revokeBadgeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'owner' };
    h.credentials.revoke.mockResolvedValue(undefined);
  });

  it('revokes the active badge and refreshes the person', async () => {
    expect(await revokeBadgeAction(idle, formOf({ personId: IDS.person }))).toEqual({
      status: 'success',
      message: 'Badge revoked.',
    });
    expect(h.credentials.revoke).toHaveBeenCalledWith(h.actor, IDS.person);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('turns a 403 into a friendly state', async () => {
    h.credentials.revoke.mockRejectedValueOnce(forbidden('no'));
    expect(await revokeBadgeAction(idle, formOf({ personId: IDS.person }))).toMatchObject({
      status: 'error',
      message: 'Your role cannot do this.',
    });
  });
});
