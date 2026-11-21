import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES, personPath } from '@buxa/shared/config/routes';
import { idle } from '@buxa/shared';
import { conflict, forbidden, badRequest, notFound } from '../../../http/errors';
import { updatePersonAction } from '../updatePersonAction';
import { formOf, IDS } from './form';
import { settle } from '@buxa/domain';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  people: { update: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { people: h.people } }) }));
vi.mock('../camp', () => ({ currentActor: () => settle(() => h.actor) }));

const details = {
  id: IDS.person,
  givenName: 'Ben',
  familyName: 'Lee',
  preferredName: '',
  dateOfBirth: '2016-05-02',
  email: 'ben@example.test',
  phone: '',
  roles: 'camper',
};

describe('updatePersonAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.redirect.mockImplementation((to: string) => {
      throw new Error(`NEXT_REDIRECT ${to}`);
    });
    h.people.update.mockResolvedValue({ id: IDS.person });
  });

  it('sends the whole patch to the service, with a blank date of birth as "none" and blank contact fields as null', async () => {
    await expect(
      updatePersonAction(idle, formOf({ ...details, dateOfBirth: '', email: '', phone: '  ' })),
    ).rejects.toThrow(`NEXT_REDIRECT ${personPath(IDS.person)}`);
    expect(h.people.update).toHaveBeenCalledWith(h.actor, IDS.person, {
      givenName: 'Ben',
      familyName: 'Lee',
      preferredName: '',
      dateOfBirth: null,
      email: '',
      phone: '',
      roles: ['camper'],
    });
  });

  it('refreshes the person page and opens it after saving', async () => {
    await expect(updatePersonAction(idle, formOf(details))).rejects.toThrow(`NEXT_REDIRECT ${personPath(IDS.person)}`);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
    expect(h.people.update).toHaveBeenCalledWith(
      h.actor,
      IDS.person,
      expect.objectContaining({ dateOfBirth: '2016-05-02', roles: ['camper'] }),
    );
  });

  it('posted from the Edit person pop-up (dialog=1) it returns a success and refreshes the list, with no redirect', async () => {
    const state = await updatePersonAction(idle, formOf({ ...details, dialog: '1' }));
    expect(state).toEqual({ status: 'success', message: 'Changes saved.' });
    expect(h.redirect).not.toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledWith(ROUTES.people);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('reports the contract messages for missing names and no role, and saves nothing', async () => {
    const state = await updatePersonAction(idle, formOf({ ...details, givenName: '', roles: [] }));
    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { givenName: 'Required.', roles: 'Pick a role.' },
    });
    expect(h.people.update).not.toHaveBeenCalled();
  });

  it('rejects a date of birth that is not a real day, as a field error', async () => {
    const state = await updatePersonAction(idle, formOf({ ...details, dateOfBirth: '2016-02-30' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { dateOfBirth: 'Use a real date (YYYY-MM-DD).' } });
    expect(h.people.update).not.toHaveBeenCalled();
  });

  it('rejects a person id that is not a UUID before calling the service', async () => {
    expect(await updatePersonAction(idle, formOf({ ...details, id: 'nope' }))).toEqual({
      status: 'error',
      message: 'That person was not found.',
    });
    expect(h.people.update).not.toHaveBeenCalled();
  });

  it('shows a viewer (403) the friendly role message', async () => {
    h.people.update.mockRejectedValueOnce(forbidden('no'));
    expect(await updatePersonAction(idle, formOf(details))).toEqual({
      status: 'error',
      message: 'Your role cannot do this.',
      fieldErrors: undefined,
    });
  });

  it('shows the service reason for a refused camper (400) and a conflict (409)', async () => {
    h.people.update.mockRejectedValueOnce(badRequest('A camper needs a household that has a parent or guardian.'));
    expect(await updatePersonAction(idle, formOf(details))).toEqual({
      status: 'error',
      message: 'A camper needs a household that has a parent or guardian.',
      fieldErrors: undefined,
    });
    h.people.update.mockRejectedValueOnce(conflict('Already changed.'));
    expect(await updatePersonAction(idle, formOf(details))).toMatchObject({
      status: 'error',
      message: 'Already changed.',
    });
  });

  it('shows a not-found person as a message, and lets server errors reach the error boundary', async () => {
    h.people.update.mockRejectedValueOnce(notFound('Person not found'));
    expect(await updatePersonAction(idle, formOf(details))).toMatchObject({
      status: 'error',
      message: 'Person not found',
    });
    h.people.update.mockRejectedValueOnce(new Error('db down'));
    await expect(updatePersonAction(idle, formOf(details))).rejects.toThrow('db down');
  });
});
