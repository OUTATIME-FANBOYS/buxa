import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { ATTACHMENT_MAX_BYTES } from '@buxa/domain';
import type { CustomField } from '@buxa/contracts';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { InMemoryRegistrationRepository } from './InMemoryRegistrationRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { InMemoryDatabase } from '../people/InMemoryDatabase';
import { RegistrationFileNotFoundError, RegistrationInvalidError } from './errors';

/*
 * Document questions and form attachments, through the service on the in-memory store (the same rules as the Postgres adapter).
 * The Postgres tests for the same paths are in PgRegistrationFiles.pg.test.ts.
 */

const CAMP_A = '11111111-1111-4111-8111-111111111111';
const CAMP_B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const CLASS_A = 'cccccccc-0000-4000-8000-00000000000a';
const CAMPER_ADA = '5e6f7a8b-1111-4a2b-8c3d-4e5f6a7b8c9d';
const CAMPER_BEN = '5e6f7a8b-2222-4a2b-8c3d-4e5f6a7b8c9d';

const CLASSES = {
  [CAMP_A]: [
    {
      classId: CLASS_A,
      sessionId: SESSION_A,
      className: 'Archery',
      startsAt: '2027-07-10T10:00:00.000Z',
      endsAt: '2027-07-10T11:00:00.000Z',
    },
  ],
  [CAMP_B]: [],
};

const PDF = new TextEncoder().encode('%PDF-1.4\n% immunization\n');
const TEXT = new TextEncoder().encode('plain text, not a document');

const as = (role: Role, orgId = CAMP_A): Actor => ({ userId: `user-${role}`, orgId, role });

const FIELDS: CustomField[] = [
  { kind: 'document', key: 'immunization', label: 'Immunization record', required: true },
  { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true },
];

const formInput = { name: 'Summer 2027', sessionIds: [SESSION_A], fields: FIELDS };

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

function setup(): RegistrationService {
  const repo = new InMemoryRegistrationRepository(
    { [CAMP_A]: [SESSION_A], [CAMP_B]: [SESSION_B] },
    undefined,
    new InMemoryCredentialRepository(new InMemoryDatabase()),
    CLASSES,
  );

  return createRegistrationService(repo, () => {
    throw new Error('no badge expected');
  });
}

/** An admin's form, published, with one attached file. */
async function publishedForm(service: RegistrationService) {
  const form = await service.createForm(as('admin'), formInput, [{ name: 'Blank form.pdf', bytes: PDF }]);
  await service.publishForm(as('admin'), form.id);

  return form;
}

const submission = (formId: string, camperId: string) => ({
  formId,
  selections: [{ camperId, classId: CLASS_A }],
  standard,
  custom: { photos: 'yes' },
});

describe('document questions and form attachments', () => {
  it('an admin adds a document question and a file families can download', async () => {
    const service = setup();
    const form = await service.createForm(as('admin'), formInput, [{ name: 'Blank form.pdf', bytes: PDF }]);

    expect(form.fields.find(f => f.key === 'immunization')?.kind).toBe('document');
    expect(form.attachments).toEqual([
      expect.objectContaining({ name: 'Blank form.pdf', contentType: 'application/pdf', sizeBytes: PDF.byteLength }),
    ]);
  });

  it('a family uploads a PDF: the answer is pending and the row names the file', async () => {
    const service = setup();
    const form = await publishedForm(service);
    await service.submit(as('staff'), form.id, submission(form.id, CAMPER_ADA), {
      immunization: { name: 'record.pdf', bytes: PDF },
    });

    const [row] = await service.listSubmissions(as('staff'), form.id);
    expect(row?.documents).toEqual([
      expect.objectContaining({ fieldKey: 'immunization', fileName: 'record.pdf', status: 'pending' }),
    ]);
    expect(row?.custom.immunization).toEqual({ fileId: row?.documents[0]?.fileId, status: 'pending' });
  });

  it('refuses a wrong type and an oversized file, with the message on the question', async () => {
    const service = setup();
    const form = await publishedForm(service);
    const textError = await service
      .submit(as('staff'), form.id, submission(form.id, CAMPER_ADA), {
        immunization: { name: 'record.pdf', bytes: TEXT },
      })
      .catch((e: unknown) => e);
    expect(textError).toBeInstanceOf(RegistrationInvalidError);
    expect((textError as RegistrationInvalidError).fieldErrors['custom.immunization']).toMatch(/not a PDF/);
    const oversized = new Uint8Array(ATTACHMENT_MAX_BYTES + 1);
    oversized.set(PDF);
    const error = await service
      .submit(as('staff'), form.id, submission(form.id, CAMPER_ADA), {
        immunization: { name: 'big.pdf', bytes: oversized },
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistrationInvalidError);
    expect((error as RegistrationInvalidError).fieldErrors['custom.immunization']).toMatch(/over 1 MB/);
    expect(await service.listSubmissions(as('staff'), form.id)).toHaveLength(0);
  });

  it('a required document left empty shows Not received, and does not stop the registration', async () => {
    const service = setup();
    const form = await publishedForm(service);
    await service.submit(as('staff'), form.id, submission(form.id, CAMPER_ADA));

    const [row] = await service.listSubmissions(as('staff'), form.id);
    expect(row?.documents).toEqual([
      expect.objectContaining({ fieldKey: 'immunization', fileId: null, status: 'not_received' }),
    ]);
  });

  it('staff review a document; a viewer cannot; the answer follows the review', async () => {
    const service = setup();
    const form = await publishedForm(service);
    await service.submit(as('staff'), form.id, submission(form.id, CAMPER_BEN), {
      immunization: { name: 'ben.pdf', bytes: PDF },
    });
    const [row] = await service.listSubmissions(as('staff'), form.id);
    const fileId = row?.documents[0]?.fileId ?? '';

    await expect(service.reviewDocument(as('viewer'), fileId, 'accepted')).rejects.toMatchObject({ statusCode: 403 });
    await service.reviewDocument(as('staff'), fileId, 'needs_replacing');
    const [after] = await service.listSubmissions(as('staff'), form.id);
    expect(after?.documents[0]?.status).toBe('needs_replacing');
    expect(after?.custom.immunization).toEqual({ fileId, status: 'needs_replacing' });

    await service.reviewDocument(as('staff'), fileId, 'accepted');
    const [accepted] = await service.listSubmissions(as('staff'), form.id);
    expect(accepted?.documents[0]?.status).toBe('accepted');
  });

  it('a form file downloads only for a session the form covers, and never for another camp', async () => {
    const service = setup();
    const form = await publishedForm(service);
    const fileId = form.attachments[0]?.id ?? '';

    const file = await service.downloadFormFile(as('staff'), fileId, SESSION_A);
    expect(file).toMatchObject({ name: 'Blank form.pdf', contentType: 'application/pdf' });
    await expect(service.downloadFormFile(as('staff'), fileId, SESSION_B)).rejects.toBeInstanceOf(
      RegistrationFileNotFoundError,
    );
    await expect(service.downloadFormFile(as('staff', CAMP_B), fileId, SESSION_A)).rejects.toBeInstanceOf(
      RegistrationFileNotFoundError,
    );
  });

  it('a family document opens for staff of its own camp only', async () => {
    const service = setup();
    const form = await publishedForm(service);
    await service.submit(as('staff'), form.id, submission(form.id, CAMPER_ADA), {
      immunization: { name: 'record.pdf', bytes: PDF },
    });
    const [row] = await service.listSubmissions(as('staff'), form.id);
    const fileId = row?.documents[0]?.fileId ?? '';

    await expect(service.downloadDocument(as('staff'), fileId)).resolves.toMatchObject({ name: 'record.pdf' });
    await expect(service.downloadDocument(as('staff', CAMP_B), fileId)).rejects.toBeInstanceOf(
      RegistrationFileNotFoundError,
    );
  });

  it('an admin removes a form file, and only a file of that form', async () => {
    const service = setup();
    const form = await publishedForm(service);
    const fileId = form.attachments[0]?.id ?? '';
    await expect(service.removeFormFile(as('staff'), form.id, fileId)).rejects.toMatchObject({ statusCode: 403 });
    await service.removeFormFile(as('admin'), form.id, fileId);
    await expect(service.removeFormFile(as('admin'), form.id, fileId)).rejects.toBeInstanceOf(
      RegistrationFileNotFoundError,
    );
  });
});
