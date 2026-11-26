import { describe, expect, it } from 'vitest';
import {
  DocumentAnswerSchema,
  DocumentReviewStatusSchema,
  buildSubmissionSchema,
  checkUpload,
  type CustomField,
} from './registration';

const FORM = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const CAMPER = '7d6c5b4a-3210-4f9e-8d7c-6b5a49382716';
const CLASS = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

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

describe('document questions and uploads', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4 immunization');
  const documentField: CustomField = {
    kind: 'document',
    key: 'immunization',
    label: 'Immunization record',
    required: true,
  };

  it('a required document with no file still passes the submission (it is Not received, not refused)', () => {
    const schema = buildSubmissionSchema([
      documentField,
      { kind: 'yes_no', key: 'photos', label: 'Photos', required: true },
    ]);
    const parsed = schema.safeParse({
      formId: FORM,
      selections: [{ camperId: CAMPER, classId: CLASS }],
      standard,
      custom: { photos: 'yes' },
    });
    expect(parsed.success).toBe(true);
  });

  it('checkUpload accepts a PDF and refuses a wrong type, an empty file, an oversized one and a blank name', () => {
    expect(checkUpload('record.pdf', pdf)).toMatchObject({
      ok: true,
      value: { name: 'record.pdf', contentType: 'application/pdf' },
    });
    expect(checkUpload('record.pdf', new TextEncoder().encode('plain'))).toEqual({
      ok: false,
      message: 'That file is not a PDF, JPEG, PNG or WebP image.',
    });
    expect(checkUpload('empty.pdf', new Uint8Array(0))).toEqual({
      ok: false,
      message: 'That file is empty. Choose another file.',
    });
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set(pdf);
    expect(checkUpload('big.pdf', big)).toEqual({
      ok: false,
      message: 'That file is over 1 MB. Choose a smaller file.',
    });
    expect(checkUpload('   ', pdf)).toMatchObject({ ok: false, message: 'The file needs a name.' });
  });

  it('the review statuses are one zod enum, and a document answer names a file and a review', () => {
    expect(DocumentReviewStatusSchema.options).toEqual(['pending', 'accepted', 'needs_replacing']);
    expect(DocumentAnswerSchema.safeParse({ fileId: FORM, status: 'pending' }).success).toBe(true);
    expect(DocumentAnswerSchema.safeParse({ fileId: FORM, status: 'maybe' }).success).toBe(false);
  });
});
