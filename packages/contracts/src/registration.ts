/**
 * Registration forms and submissions. The server validates every request with these schemas and re-validates a submission
 * against the form version it was answered against; the browser is never trusted.
 */
import { z } from 'zod';
import {
  ATTACHMENT_MAX_BYTES,
  DOCUMENT_REVIEW_STATUSES,
  DOCUMENT_STATUSES,
  sniffAttachmentType,
  type AttachmentContentType,
} from '@buxa/domain';
import { PersonPhoneSchema } from './contact';
import { RequiredDateOfBirthSchema } from './people';

export const FIELD_KINDS = ['text', 'choice', 'date', 'yes_no', 'document'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** A document's review, from the domain's one list. Staff set it; a submitted document starts as pending. */
export const DocumentReviewStatusSchema = z.enum(DOCUMENT_REVIEW_STATUSES);
export const DocumentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentReviewStatusValue = z.infer<typeof DocumentReviewStatusSchema>;

/** What a document answer stores: the id of the uploaded file and its review. The bytes live in registration_files. */
export const DocumentAnswerSchema = z.object({
  fileId: z.string().uuid(),
  status: DocumentReviewStatusSchema,
});
export type DocumentAnswer = z.infer<typeof DocumentAnswerSchema>;

/** A custom field's key. Lowercase, so it can never collide with the camelCase standard fields. */
export const FieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Use lowercase letters, numbers and underscores, starting with a letter.');

const LabelSchema = z.string().trim().min(1, 'Enter a label.').max(120, 'Keep the label to 120 characters.');

const FieldBaseSchema = z.object({
  key: FieldKeySchema,
  label: LabelSchema,
  required: z.boolean(),
});

/** One custom question the camp defines. Typed, so the answer is checked by schema. */
export const CustomFieldSchema = z.discriminatedUnion('kind', [
  FieldBaseSchema.extend({ kind: z.literal('text') }),
  FieldBaseSchema.extend({
    kind: z.literal('choice'),
    options: z
      .array(z.string().trim().min(1, 'Each choice needs text.').max(120))
      .min(2, 'A choice question needs at least two options.')
      .max(30),
  }),
  FieldBaseSchema.extend({ kind: z.literal('date') }),
  FieldBaseSchema.extend({ kind: z.literal('yes_no') }),
  // A file the family uploads (an immunization record, say). Required means "expected": a missing one is shown as Not received
  // to staff, and does not stop the registration (see documentStatusOf in @buxa/domain).
  FieldBaseSchema.extend({ kind: z.literal('document') }),
]);
export type CustomField = z.infer<typeof CustomFieldSchema>;
/** A custom question that is answered with a value in the submission (every kind except a document, whose answer is a file). */
export type ValueField = Exclude<CustomField, { kind: 'document' }>;
export const isValueField = (field: CustomField): field is ValueField => field.kind !== 'document';

/** The checks a stored file must pass. Pure: the type comes from the file's first bytes, never from its name or the browser. */
export type UploadProblem = string;

export interface CheckedUpload {
  name: string;
  bytes: Uint8Array;
  contentType: AttachmentContentType;
}

/** Checks one uploaded file: a name, not empty, not over the limit, and a PDF or image by its bytes. */
export function checkUpload(
  name: string,
  bytes: Uint8Array,
): { ok: true; value: CheckedUpload } | { ok: false; message: UploadProblem } {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, message: 'The file needs a name.' };
  }
  if (trimmed.length > 255) {
    return { ok: false, message: 'Keep the file name to 255 characters.' };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, message: 'That file is empty. Choose another file.' };
  }
  if (bytes.byteLength > ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      message: `That file is over ${ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB. Choose a smaller file.`,
    };
  }
  const contentType = sniffAttachmentType(bytes);
  if (contentType === null) {
    return { ok: false, message: 'That file is not a PDF, JPEG, PNG or WebP image.' };
  }

  return { ok: true, value: { name: trimmed, bytes, contentType } };
}

/** A file a family or staff member attached to a form, as the page shows it (no bytes). */
export const FormAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
});
export type FormAttachment = z.infer<typeof FormAttachmentSchema>;

/** A document question's status on one registration, as staff see it. `fileId` and `fileName` are null when nothing was sent. */
export const RegistrationDocumentSchema = z.object({
  fieldKey: z.string(),
  label: z.string(),
  fileId: z.string().nullable(),
  fileName: z.string().nullable(),
  status: DocumentStatusSchema,
});
export type RegistrationDocument = z.infer<typeof RegistrationDocumentSchema>;

export const MAX_CUSTOM_FIELDS = 40;

/**
 * The standard fields every form has: the camper and the parent or guardian. Keys are camelCase. The emergency contact is not
 * asked for here: it is kept on the person's page only (migration 0073). The camper's name and date of birth are read from the
 * person record by the server, so a registration never changes them.
 */
export const STANDARD_FIELDS = [
  { key: 'camperFirstName', label: 'Camper first name', required: true },
  { key: 'camperLastName', label: 'Camper last name', required: true },
  { key: 'camperBirthDate', label: 'Camper date of birth', required: true },
  { key: 'guardianName', label: 'Parent or guardian name', required: true },
  { key: 'guardianDateOfBirth', label: 'Parent or guardian date of birth', required: true },
  { key: 'guardianEmail', label: 'Parent or guardian email', required: false },
  { key: 'guardianPhone', label: 'Parent or guardian phone', required: true },
] as const;

/**
 * A form as the camp edits it: name, the session set and the custom questions. A season is no longer entered (migration 0071 kept
 * the stored value for history); the server writes it as null.
 */
export const RegistrationFormInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a form name.').max(120, 'Keep the name to 120 characters.'),
    sessionIds: z
      .array(z.string().uuid())
      .min(1, 'Choose at least one session.')
      .max(200)
      .transform(ids => [...new Set(ids)]),
    fields: z.array(CustomFieldSchema).max(MAX_CUSTOM_FIELDS, `Use at most ${MAX_CUSTOM_FIELDS} custom questions.`),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'key'],
          message: `Two questions use the key "${field.key}". Give each one its own key.`,
        });
      }
      seen.add(field.key);
      if (field.kind === 'choice' && new Set(field.options).size !== field.options.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'options'],
          message: 'Two choices are the same. Give each option its own text.',
        });
      }
    });
  });
export type RegistrationFormInput = z.infer<typeof RegistrationFormInputSchema>;

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-06-14.')
  .refine(v => {
    const d = new Date(`${v}T00:00:00Z`);

    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'That is not a real date.');

/** Blank text is "no answer". Yes and no arrive as booleans or as the words from a select. */
const blankAsMissing = (value: unknown): unknown =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

/** One child and one class of the family's request. The session is taken from the class, so the family picks no session. */
export const ClassSelectionSchema = z.object({
  camperId: z.string().uuid(),
  classId: z.string().uuid(),
});
export type ClassSelectionInput = z.infer<typeof ClassSelectionSchema>;

export const MAX_CLASS_SELECTIONS = 200;

const YesNo = z.union([z.boolean(), z.enum(['yes', 'no'])]).transform(v => (typeof v === 'boolean' ? v : v === 'yes'));

/** The schema for one custom answer, built from its definition. Optional answers that are blank are left out. */
function answerSchema(field: ValueField): z.ZodType<string | boolean | undefined> {
  let base: z.ZodType<string | boolean>;
  switch (field.kind) {
    case 'text':
      base = field.required
        ? z.string().trim().min(1, `${field.label} is required.`).max(2000, `${field.label} is too long.`)
        : z.string().trim().max(2000, `${field.label} is too long.`);
      break;
    case 'choice': {
      const options = field.options;
      base = z.string().refine(v => options.includes(v), `Choose one of the options for ${field.label}.`);
      break;
    }
    case 'date':
      base = IsoDate;
      break;
    case 'yes_no':
      base = YesNo;
      break;
  }

  // A required blank becomes '' so the schema's own message ("is required", "choose one") is the one shown.
  return field.required
    ? z.preprocess(v => blankAsMissing(v) ?? '', base)
    : z.preprocess(blankAsMissing, base.optional());
}

/**
 * The schema a submission is checked against: the standard fields, plus one entry per custom question in the form version.
 * The output keeps only the answers that were given, so an empty optional answer is not stored.
 */
export function buildSubmissionSchema(fields: readonly CustomField[]) {
  const standardShape = Object.fromEntries(
    STANDARD_FIELDS.map(f => {
      // The parent's date of birth and phone are the person rules, with the same messages as the Add person form.
      if (f.key === 'guardianDateOfBirth' || f.key === 'guardianPhone') {
        const personRule = f.key === 'guardianPhone' ? PersonPhoneSchema : RequiredDateOfBirthSchema;

        return [f.key, z.preprocess(v => blankAsMissing(v) ?? '', personRule)];
      }
      const text = z.string().trim().max(120, `${f.label} is too long.`);
      const value =
        f.key === 'camperBirthDate'
          ? IsoDate
          : f.key === 'guardianEmail'
            ? z.string().trim().email('Enter a valid email address.').max(254)
            : text;
      const required = f.required ? value.min(1, `${f.label} is required.`) : value.optional();

      return [f.key, z.preprocess(blankAsMissing, required)];
    }),
  );
  // Document answers are files, checked by checkUpload; they are not in this value shape.
  const customShape = Object.fromEntries(fields.filter(isValueField).map(f => [f.key, answerSchema(f)]));

  return z.object({
    formId: z.string().uuid(),
    selections: z
      .array(ClassSelectionSchema)
      .min(1, 'Choose at least one class.')
      .max(MAX_CLASS_SELECTIONS, 'Choose fewer classes.'),
    standard: z.object(standardShape),
    custom: z.object(customShape),
  });
}
export type SubmissionInput = z.infer<ReturnType<typeof buildSubmissionSchema>>;

/** A stored registration, as staff see it: the answers and the sessions it asks for. */
export const RegistrationSessionSchema = z.object({
  sessionId: z.string(),
  sessionName: z.string(),
  status: z.enum(['submitted']),
});

/**
 * One child's place in one class of a registration, as staff see it. `status` is read from the hold or the enrolment behind it:
 * held (a seat hold, not yet confirmed), waitlisted, enrolled, expired (the hold ran out before confirmation) or cancelled.
 */
export const REGISTRATION_CLASS_STATUSES = ['held', 'waitlisted', 'enrolled', 'expired', 'cancelled'] as const;
export const RegistrationClassSchema = z.object({
  id: z.string(),
  classId: z.string(),
  className: z.string(),
  sessionId: z.string(),
  sessionName: z.string(),
  camperId: z.string(),
  camperName: z.string(),
  status: z.enum(REGISTRATION_CLASS_STATUSES),
  paymentStatus: z.enum(['unpaid', 'paid']),
  paymentNote: z.string().nullable(),
  /** The price the family saw at submission (the early-bird amount when it applied), or null for an old place or a class with no price. */
  price: z.object({ amountMinor: z.number().int(), currency: z.string(), earlyBird: z.boolean() }).nullable(),
});
export type RegistrationClass = z.infer<typeof RegistrationClassSchema>;

export const RegistrationRowSchema = z.object({
  id: z.string(),
  formVersion: z.number().int(),
  submittedAt: z.string(),
  /** Recorded as pending; a staff member confirms it (decision 3). */
  status: z.enum(['pending', 'confirmed', 'withdrawn']),
  confirmedAt: z.string().nullable(),
  /** When the registration was withdrawn (holds released, enrolments cancelled, record kept), or null. */
  withdrawnAt: z.string().nullable(),
  /** When the registration was archived (hidden from lists, kept), or null. */
  archivedAt: z.string().nullable(),
  standard: z.record(z.string(), z.string().optional()),
  custom: z.record(z.string(), z.union([z.string(), z.boolean(), DocumentAnswerSchema]).optional()),
  /** Each document question of the form version, with its file and review (Not received when a required one is missing). */
  documents: z.array(RegistrationDocumentSchema),
  sessions: z.array(RegistrationSessionSchema),
  classes: z.array(RegistrationClassSchema),
});
export type RegistrationRow = z.infer<typeof RegistrationRowSchema>;

/** The published version of a form: what families register on, and what each registration was checked against (migration 0071). */
export const PublishedFormSchema = z.object({
  version: z.number().int().positive(),
  name: z.string(),
  season: z.string().nullable(),
  /** The sessions the version covers, by id and name, in name order. Families may register only for these. */
  sessions: z.array(z.object({ id: z.string(), name: z.string() })),
  fields: z.array(CustomFieldSchema),
});
export type PublishedForm = z.infer<typeof PublishedFormSchema>;

/**
 * A form as staff see it. The top-level name, season, sessions and fields are the DRAFT (what the edit pop-up loads and Save draft
 * writes). `published` is the version families register on (null until the first publish), and `hasUnpublishedChanges` is true when
 * the draft differs from it.
 */
export const RegistrationFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  season: z.string().nullable(),
  /** The draft's sessions, by id and name, in name order. */
  sessions: z.array(z.object({ id: z.string(), name: z.string() })),
  fields: z.array(CustomFieldSchema),
  /** Files staff attached for families to download (a blank immunization form, say). */
  attachments: z.array(FormAttachmentSchema),
  publishedVersion: z.number().int().nullable(),
  published: PublishedFormSchema.nullable(),
  hasUnpublishedChanges: z.boolean(),
  submissionCount: z.number().int(),
  updatedAt: z.string(),
});
export type RegistrationForm = z.infer<typeof RegistrationFormSchema>;

/**
 * A staff member's record of how a class place was paid. Payment is by hand for now (no online payment yet). A place marked paid
 * needs a note saying how (for example the date and the method), so the record says something on its own.
 */
export const RecordPaymentInputSchema = z
  .object({
    paid: z.boolean(),
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters.')
      .default('')
      .transform(v => v || null),
  })
  .superRefine((input, ctx) => {
    if (input.paid && input.note === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Add a note saying how it was paid, such as the date and the method.',
      });
    }
  });
export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;
