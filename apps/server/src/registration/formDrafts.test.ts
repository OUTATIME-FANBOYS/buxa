import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { createRegistrationService } from './RegistrationService';
import { InMemoryRegistrationRepository } from './InMemoryRegistrationRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { InMemoryDatabase } from '../people/InMemoryDatabase';
import { RegistrationFormNoSessionsError, RegistrationRefusedError } from './errors';

/*
 * The whole form is a draft until it is published (migration 0071). Saving a draft changes the draft only: families register on the
 * published version, and the Registration page shows the published name and version. A publish copies the draft into the version.
 */

const CAMP = '11111111-1111-4111-8111-111111111111';
const SESSION_LIVE = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION_NEW = 'aaaaaaaa-0000-4000-8000-000000000002';
const CLASS_LIVE = 'cccccccc-0000-4000-8000-00000000000a';
const CLASS_NEW = 'cccccccc-0000-4000-8000-00000000000d';
const CAMPER = '5e6f7a8b-1111-4a2b-8c3d-4e5f6a7b8c9d';

const question = { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true } as const;
const extra = { kind: 'text', key: 'allergies', label: 'Allergies', required: false } as const;

const input = {
  name: 'Summer 2027',
  sessionIds: [SESSION_LIVE],
  fields: [question],
};

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

const as = (role: Role): Actor => ({ userId: `user-${role}`, orgId: CAMP, role });

function setup() {
  const repo = new InMemoryRegistrationRepository(
    { [CAMP]: [SESSION_LIVE, SESSION_NEW] },
    () => [CAMPER],
    new InMemoryCredentialRepository(new InMemoryDatabase()),
    {
      [CAMP]: [
        {
          classId: CLASS_LIVE,
          sessionId: SESSION_LIVE,
          className: 'Archery',
          startsAt: '2027-07-10T10:00:00.000Z',
          endsAt: '2027-07-10T11:00:00.000Z',
        },
        {
          classId: CLASS_NEW,
          sessionId: SESSION_NEW,
          className: 'Climbing',
          startsAt: '2027-07-11T10:00:00.000Z',
          endsAt: '2027-07-11T11:00:00.000Z',
        },
      ],
    },
  );
  // Badges are not part of these tests: a confirmation is never run here.

  return {
    repo,
    service: createRegistrationService(repo, () => {
      throw new Error('no badge expected in this test');
    }),
  };
}

describe('registration form drafts: save and publish', () => {
  it('saving a draft changes the draft and leaves the published version alone', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    await service.publishForm(admin, form.id);

    await service.updateForm(admin, form.id, {
      name: 'Summer 2028',
      sessionIds: [SESSION_LIVE, SESSION_NEW],
      fields: [question, extra],
    });

    const saved = await service.getForm(admin, form.id);
    // The draft: what the edit pop-up loads.
    expect(saved.name).toBe('Summer 2028');
    expect(saved.season).toBeNull();
    expect(saved.sessions.map(s => s.id).sort()).toEqual([SESSION_LIVE, SESSION_NEW].sort());
    expect(saved.fields.map(f => f.key)).toEqual(['photos', 'allergies']);
    // The published version: unchanged, and the Registration page can say the draft differs.
    expect(saved.publishedVersion).toBe(1);
    expect(saved.published).toMatchObject({
      version: 1,
      name: 'Summer 2027',
      season: null,
      sessions: [{ id: SESSION_LIVE, name: SESSION_LIVE }],
    });
    expect(saved.published?.fields.map(f => f.key)).toEqual(['photos']);
    expect(saved.hasUnpublishedChanges).toBe(true);
  });

  it('publishing copies the draft into the published version: name, sessions and questions', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    await service.publishForm(admin, form.id);
    await service.updateForm(admin, form.id, {
      name: 'Summer 2028',
      sessionIds: [SESSION_LIVE, SESSION_NEW],
      fields: [question, extra],
    });

    const published = await service.publishForm(admin, form.id);

    expect(published.publishedVersion).toBe(2);
    expect(published.published).toMatchObject({
      version: 2,
      name: 'Summer 2028',
      season: null,
    });
    expect(published.published?.sessions.map(s => s.id).sort()).toEqual([SESSION_LIVE, SESSION_NEW].sort());
    expect(published.published?.fields.map(f => f.key)).toEqual(['photos', 'allergies']);
    expect(published.hasUnpublishedChanges).toBe(false);
  });

  it('a family cannot register for a session that is only in the draft', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    await service.publishForm(admin, form.id);
    await service.updateForm(admin, form.id, {
      name: 'Summer 2027',
      sessionIds: [SESSION_LIVE, SESSION_NEW],
      fields: [question],
    });

    const familyView = await service.publishedVersion(as('staff'), form.id);
    expect(familyView?.sessions.map(s => s.id)).toEqual([SESSION_LIVE]);

    const submission = {
      formId: form.id,
      selections: [{ camperId: CAMPER, classId: CLASS_NEW }],
      standard,
      custom: { photos: 'yes' },
    };
    await expect(service.submit(as('staff'), form.id, submission)).rejects.toMatchObject({
      reason: 'session_not_in_form',
    });
    await expect(service.listSubmissions(as('staff'), form.id)).resolves.toEqual([]);
  });

  it('a family can register for a session that a publish has added', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    await service.publishForm(admin, form.id);
    await service.updateForm(admin, form.id, {
      name: 'Summer 2027',
      sessionIds: [SESSION_LIVE, SESSION_NEW],
      fields: [question],
    });
    await service.publishForm(admin, form.id);

    const submission = {
      formId: form.id,
      selections: [{ camperId: CAMPER, classId: CLASS_NEW }],
      standard,
      custom: { photos: 'yes' },
    };
    await expect(service.submit(as('staff'), form.id, submission)).resolves.toEqual(expect.any(String));
  });

  it('publishing a form whose draft has no sessions is refused, and no version is written', async () => {
    const { repo, service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    // The service validates a draft (at least one session) before it saves; the repository is called directly to model a draft
    // that has lost its sessions.
    await repo.updateForm(admin, form.id, { ...input, season: null, sessionIds: [] }, []);

    await expect(service.publishForm(admin, form.id)).rejects.toBeInstanceOf(RegistrationFormNoSessionsError);
    const after = await service.getForm(admin, form.id);
    expect(after.publishedVersion).toBeNull();
    expect(after.published).toBeNull();
  });

  it('a form that was never published shows no published values and no unpublished note', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    await service.updateForm(admin, form.id, { ...input, name: 'Changed draft' });

    const view = await service.getForm(admin, form.id);
    expect(view.published).toBeNull();
    expect(view.hasUnpublishedChanges).toBe(false);
    expect(view.name).toBe('Changed draft');
  });

  it('a submission to a form that was never published is still refused', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin'), input);
    await expect(
      service.submit(as('staff'), form.id, { formId: form.id, selections: [], standard, custom: {} }),
    ).rejects.toBeInstanceOf(RegistrationRefusedError);
  });
});

describe('registration form season: no longer entered', () => {
  it('a new form stores a null season, even when a season is sent with it', async () => {
    const { service } = setup();
    const admin = as('admin');
    const withSeason = { ...input, season: 'Summer 2027' };

    const form = await service.createForm(admin, withSeason);

    expect(form.season).toBeNull();
  });

  it('a draft save writes a null season', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, input);
    const withSeason = { name: 'Summer 2028', sessionIds: [SESSION_LIVE], fields: [question], season: 'Autumn' };

    await service.updateForm(admin, form.id, withSeason);

    expect((await service.getForm(admin, form.id)).season).toBeNull();
  });

  it('a form stored with an old season still reads it, and publishing keeps it', async () => {
    const { repo, service } = setup();
    const admin = as('admin');
    const old = await repo.createForm(admin, { ...input, season: 'Summer 2027' }, []);

    const read = await service.getForm(admin, old.id);
    expect(read.season).toBe('Summer 2027');

    const published = await service.publishForm(admin, old.id);
    expect(published.published?.season).toBe('Summer 2027');
  });
});
