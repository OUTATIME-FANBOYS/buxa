import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import type { Actor, Role } from '@buxa/domain';
import type { CustomField } from '@buxa/contracts';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { RegistrationFileNotFoundError, RegistrationInvalidError } from './errors';
import { HttpError } from '../http/errors';
import { createRegistrationFixture, pgPeopleService, type RegistrationFixture } from './__tests__/registrationFixture';
import { createCredentialService } from '../services/credentials/createCredentialService';
import { createBadgeCipher, parseBadgeKey } from '../credentials/badgeCipher';
import { PgPeopleRepository } from '../people/PgPeopleRepository';
import { PgMembershipRepository } from '../memberships/PgMembershipRepository';
import { PgAttendanceRepository } from '../attendance/PgAttendanceRepository';
import { PgOrgRepository } from '../orgs/PgOrgRepository';
import { systemClock } from '../services/clock';
import { ATTACHMENT_MAX_BYTES } from '@buxa/domain';

/** A fixed test key (32 bytes, base64). Never a real key. */
const TEST_KEY = Buffer.alloc(32, 3).toString('base64');
const url = process.env.DATABASE_URL;

const PDF = new TextEncoder().encode('%PDF-1.4\n% immunization record\n');
const TEXT = new TextEncoder().encode('just some text, not a PDF');

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianDateOfBirth: '1979-11-02',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

const FIELDS: CustomField[] = [
  { kind: 'document', key: 'immunization', label: 'Immunization record', required: true },
  { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true },
];

// Files in Postgres: a form's attachments and a family's documents are stored under the camp's row-level security. A camp cannot
// read another camp's files, a download needs the form to cover the session, and erasing a registration removes its files.
describe.skipIf(!url)('registration files in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  const service: RegistrationService = createRegistrationService(
    repo,
    credentials =>
      createCredentialService({
        credentials,
        people: new PgPeopleRepository(pool),
        memberships: new PgMembershipRepository(pool),
        attendance: new PgAttendanceRepository(pool),
        orgs: new PgOrgRepository(pool),
        clock: systemClock,
        cipher: createBadgeCipher(() => parseBadgeKey(TEST_KEY)),
      }),
    pgPeopleService(pool),
  );

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** A second person in the camp with a given role, for the role checks. */
  async function memberOf(orgId: string, role: Role): Promise<Actor> {
    const tag = randomBytes(6).toString('hex');
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Files test') RETURNING id`,
      [`files-${role}-${tag}@reg.test`],
    );
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)`, [orgId, rows[0].id, role]);

    return { userId: rows[0].id, orgId, role };
  }

  const formInput = (sessionId: string) => ({
    name: 'Summer 2027',
    sessionIds: [sessionId],
    fields: FIELDS,
  });

  const submission = (formId: string, camperId: string, classId: string) => ({
    formId,
    selections: [{ camperId, classId }],
    standard,
    custom: { photos: 'yes' },
  });

  async function campWithPublishedForm(): Promise<{ camp: RegistrationFixture; admin: Actor; formId: string }> {
    const camp = await createRegistrationFixture(pool);
    const admin = camp.actor('admin');
    const form = await service.createForm(admin, formInput(camp.sessionId), [
      { name: 'Blank immunization form.pdf', bytes: PDF },
    ]);
    await service.publishForm(admin, form.id);

    return { camp, admin, formId: form.id };
  }

  it('an admin attaches a PDF to a form; the covering session may download it, and no other camp can', async () => {
    const { camp, admin, formId } = await campWithPublishedForm();
    const form = await service.getForm(admin, formId);
    const attachment = form.attachments[0];
    expect(attachment?.name).toBe('Blank immunization form.pdf');

    const staff = await memberOf(camp.orgId, 'staff');
    const file = await service.downloadFormFile(staff, attachment?.id ?? '', camp.sessionId);
    expect(new TextDecoder().decode(file.bytes)).toContain('%PDF-1.4');
    expect(file.contentType).toBe('application/pdf');

    // A session the form does not cover reads as not found, and so does a file of another camp.
    await expect(
      service.downloadFormFile(staff, attachment?.id ?? '', '99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(RegistrationFileNotFoundError);
    const other = await campWithPublishedForm();
    const otherStaff = await memberOf(other.camp.orgId, 'staff');
    await expect(
      service.downloadFormFile(otherStaff, attachment?.id ?? '', other.camp.sessionId),
    ).rejects.toBeInstanceOf(RegistrationFileNotFoundError);
    await expect(service.downloadFormFile(other.admin, attachment?.id ?? '', camp.sessionId)).rejects.toBeInstanceOf(
      RegistrationFileNotFoundError,
    );
  });

  it('a family document is stored with the registration as pending, and a wrong type or an oversized file is refused', async () => {
    const { camp, formId } = await campWithPublishedForm();
    const staff = await memberOf(camp.orgId, 'staff');
    await service.submit(staff, formId, submission(formId, camp.children.ada, camp.classes.climbing), {
      immunization: { name: 'record.pdf', bytes: PDF },
    });
    const [row] = await service.listSubmissions(staff, formId);
    expect(row?.documents).toEqual([
      expect.objectContaining({ fieldKey: 'immunization', fileName: 'record.pdf', status: 'pending' }),
    ]);

    // A text file named .pdf is refused by its bytes; nothing is stored.
    const textError = await service
      .submit(staff, formId, submission(formId, camp.children.ben, camp.classes.climbing), {
        immunization: { name: 'record.pdf', bytes: TEXT },
      })
      .catch((e: unknown) => e);
    expect(textError).toBeInstanceOf(RegistrationInvalidError);
    expect((textError as RegistrationInvalidError).fieldErrors['custom.immunization']).toMatch(/not a PDF/);
    const oversized = new Uint8Array(ATTACHMENT_MAX_BYTES + 1);
    oversized.set(PDF);
    await expect(
      service.submit(staff, formId, submission(formId, camp.children.ben, camp.classes.climbing), {
        immunization: { name: 'big.pdf', bytes: oversized },
      }),
    ).rejects.toBeInstanceOf(RegistrationInvalidError);
    expect(await service.listSubmissions(staff, formId)).toHaveLength(1);
  });

  it('a required document left empty is Not received; staff review it, and a viewer cannot', async () => {
    const { camp, formId } = await campWithPublishedForm();
    const staff = await memberOf(camp.orgId, 'staff');
    const viewer = await memberOf(camp.orgId, 'viewer');
    await service.submit(staff, formId, submission(formId, camp.children.ada, camp.classes.climbing));
    const [row] = await service.listSubmissions(staff, formId);
    expect(row?.documents).toEqual([expect.objectContaining({ fieldKey: 'immunization', status: 'not_received' })]);

    await service.submit(staff, formId, submission(formId, camp.children.ben, camp.classes.climbing), {
      immunization: { name: 'ben.pdf', bytes: PDF },
    });
    const rows = await service.listSubmissions(staff, formId);
    const benRow = rows.find(r => r.documents.some(d => d.fileName === 'ben.pdf'));
    const fileId = benRow?.documents[0]?.fileId ?? '';

    await expect(service.reviewDocument(viewer, fileId, 'accepted')).rejects.toBeInstanceOf(HttpError);
    await expect(service.reviewDocument(staff, fileId, 'maybe')).rejects.toBeInstanceOf(RegistrationInvalidError);

    await service.reviewDocument(staff, fileId, 'needs_replacing');
    const after = (await service.listSubmissions(staff, formId)).find(r => r.id === benRow?.id);
    expect(after?.documents[0]?.status).toBe('needs_replacing');
    expect(after?.custom.immunization).toEqual({ fileId, status: 'needs_replacing' });
    await service.reviewDocument(staff, fileId, 'accepted');
    const accepted = (await service.listSubmissions(staff, formId)).find(r => r.id === benRow?.id);
    expect(accepted?.documents[0]?.status).toBe('accepted');
  });

  it('erasing a registration removes its documents with it', async () => {
    const { camp, admin, formId } = await campWithPublishedForm();
    const staff = await memberOf(camp.orgId, 'staff');
    const id = await service.submit(staff, formId, submission(formId, camp.children.ada, camp.classes.climbing), {
      immunization: { name: 'erase.pdf', bytes: PDF },
    });
    const before = await pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM registration_files WHERE registration_id = $1',
      [id],
    );
    expect(before.rows[0]?.n).toBe('1');

    await service.erase(admin, id);

    const after = await pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM registration_files WHERE registration_id = $1',
      [id],
    );
    expect(after.rows[0]?.n).toBe('0');
  });
});
