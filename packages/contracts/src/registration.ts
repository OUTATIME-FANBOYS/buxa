/**
 * Registration forms and submissions. The server validates every request with these schemas and re-validates a submission
 * against the form version it was answered against; the browser is never trusted.
 */
import { z } from 'zod';

export const FIELD_KINDS = ['text', 'choice', 'date', 'yes_no'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

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
]);
export type CustomField = z.infer<typeof CustomFieldSchema>;

export const MAX_CUSTOM_FIELDS = 40;

/** The standard fields every form has: the camper, the guardian and an emergency contact. Keys are camelCase. */
export const STANDARD_FIELDS = [
  { key: 'camperFirstName', label: 'Camper first name', required: true },
  { key: 'camperLastName', label: 'Camper last name', required: true },
  { key: 'camperBirthDate', label: 'Camper date of birth', required: true },
  { key: 'guardianName', label: 'Parent or guardian name', required: true },
  { key: 'guardianEmail', label: 'Parent or guardian email', required: false },
  { key: 'guardianPhone', label: 'Parent or guardian phone', required: true },
  { key: 'emergencyContactName', label: 'Emergency contact name', required: true },
  { key: 'emergencyContactPhone', label: 'Emergency contact phone', required: true },
] as const;

/** A form as the camp edits it: name, season, the session set and the custom questions. */
export const RegistrationFormInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a form name.').max(120, 'Keep the name to 120 characters.'),
    season: z
      .string()
      .trim()
      .max(60, 'Keep the season to 60 characters.')
      .default('')
      .transform(v => v || null),
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

const YesNo = z.union([z.boolean(), z.enum(['yes', 'no'])]).transform(v => (typeof v === 'boolean' ? v : v === 'yes'));

/** The schema for one custom answer, built from its definition. Optional answers that are blank are left out. */
function answerSchema(field: CustomField): z.ZodType<string | boolean | undefined> {
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
  const customShape = Object.fromEntries(fields.map(f => [f.key, answerSchema(f)]));

  return z.object({
    formId: z.string().uuid(),
    sessionIds: z.array(z.string().uuid()).min(1, 'Choose at least one session.').max(200),
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

export const RegistrationRowSchema = z.object({
  id: z.string(),
  formVersion: z.number().int(),
  submittedAt: z.string(),
  /** Recorded as pending; a staff member confirms it (decision 3). */
  status: z.enum(['pending', 'confirmed']),
  confirmedAt: z.string().nullable(),
  standard: z.record(z.string(), z.string().optional()),
  custom: z.record(z.string(), z.union([z.string(), z.boolean()]).optional()),
  sessions: z.array(RegistrationSessionSchema),
});
export type RegistrationRow = z.infer<typeof RegistrationRowSchema>;

export const RegistrationFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  season: z.string().nullable(),
  /** The sessions the form covers, by id and name, in name order. */
  sessions: z.array(z.object({ id: z.string(), name: z.string() })),
  fields: z.array(CustomFieldSchema),
  publishedVersion: z.number().int().nullable(),
  submissionCount: z.number().int(),
  updatedAt: z.string(),
});
export type RegistrationForm = z.infer<typeof RegistrationFormSchema>;
