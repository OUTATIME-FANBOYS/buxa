import { documentStatusOf } from '@buxa/domain';
import { DocumentAnswerSchema, type CustomField, type RegistrationDocument } from '@buxa/contracts';

/*
 * The document questions of one registration, as staff see them: each question of the form version with its file and review. A
 * required question with no answer is "Not received"; an optional one with no answer is left out. Pure: the caller reads the form
 * version and the file names.
 */

/**
 * @param fields the form version's questions.
 * @param custom the registration's stored custom answers (a document answer is { fileId, status }).
 * @param fileNames the name of each stored file, by its id, for this registration.
 */
export function documentRowsFor(
  fields: readonly CustomField[],
  custom: Record<string, unknown>,
  fileNames: ReadonlyMap<string, string>,
): RegistrationDocument[] {
  const rows: RegistrationDocument[] = [];
  for (const field of fields) {
    if (field.kind !== 'document') {
      continue;
    }
    const parsed = DocumentAnswerSchema.safeParse(custom[field.key]);
    const answer = parsed.success ? parsed.data : undefined;
    const status = documentStatusOf(answer, field.required);
    if (status === null) {
      continue;
    }
    rows.push({
      fieldKey: field.key,
      label: field.label,
      fileId: answer?.fileId ?? null,
      fileName: answer ? (fileNames.get(answer.fileId) ?? null) : null,
      status,
    });
  }

  return rows;
}
