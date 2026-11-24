import type { Actor, DocumentReviewStatus } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import { RegistrationFileNotFoundError } from './errors';
import type { FileDownload, NewDocument, StoredFileInput } from './RegistrationRepository';

/*
 * Files for registration: the attachments a form offers families (registration_form_files) and the documents a family sends with
 * a registration (registration_files). Each write audits itself in the same transaction; the caller runs it inside withOrg, so row
 * level security applies to every statement here.
 */

/** Adds the files to a form. Each one is audited with its id and size, never its contents. */
export async function insertFormFilesInTx(
  db: Db,
  actor: Actor,
  formId: string,
  files: readonly StoredFileInput[],
): Promise<void> {
  for (const file of files) {
    await db.query(
      `INSERT INTO registration_form_files (id, org_id, form_id, name, content_type, size_bytes, bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        file.id,
        actor.orgId,
        formId,
        file.name,
        file.contentType,
        file.bytes.byteLength,
        Buffer.from(file.bytes),
        actor.userId,
      ],
    );
    await recordAudit(db, {
      actor,
      action: 'registration_form.file_add',
      entity: 'registration_form',
      entityId: formId,
      data: { fileId: file.id, sizeBytes: file.bytes.byteLength },
    });
  }
}

/** Removes an attachment of a form. Throws RegistrationFileNotFoundError when the form has no such file in this camp. */
export async function removeFormFileInTx(db: Db, actor: Actor, formId: string, fileId: string): Promise<void> {
  const { rowCount } = await db.query(
    'DELETE FROM registration_form_files WHERE id = $1 AND form_id = $2 AND org_id = $3',
    [fileId, formId, actor.orgId],
  );
  if (!rowCount) {
    throw new RegistrationFileNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'registration_form.file_remove',
    entity: 'registration_form',
    entityId: formId,
    data: { fileId },
  });
}

/**
 * A form attachment for a session. The join is the check: the file's form must cover the session. A file of another form, or a
 * session the form does not cover, reads as no row.
 */
export async function formFileInTx(db: Db, fileId: string, sessionId: string): Promise<FileDownload | null> {
  const { rows } = await db.query<{ id: string; name: string; content_type: string; bytes: Buffer }>(
    `SELECT f.id, f.name, f.content_type, f.bytes
       FROM registration_form_files f
      WHERE f.id = $1
        AND EXISTS (
          SELECT 1 FROM registration_form_sessions s
           WHERE s.form_id = f.form_id AND s.org_id = f.org_id AND s.session_id = $2
        )`,
    [fileId, sessionId],
  );

  return rows[0]
    ? { id: rows[0].id, name: rows[0].name, contentType: rows[0].content_type, bytes: rows[0].bytes }
    : null;
}

/** A family's document, read by its id. Null when the file is not in this camp. */
export async function documentInTx(db: Db, fileId: string): Promise<FileDownload | null> {
  const { rows } = await db.query<{ id: string; name: string; content_type: string; bytes: Buffer }>(
    'SELECT id, name, content_type, bytes FROM registration_files WHERE id = $1',
    [fileId],
  );

  return rows[0]
    ? { id: rows[0].id, name: rows[0].name, contentType: rows[0].content_type, bytes: rows[0].bytes }
    : null;
}

/** Stores the documents of a new registration. Runs inside the submission's transaction, after the registration row exists. */
export async function insertDocumentsInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  documents: readonly NewDocument[],
): Promise<void> {
  for (const document of documents) {
    await db.query(
      `INSERT INTO registration_files (id, org_id, registration_id, field_key, name, content_type, size_bytes, bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        document.id,
        actor.orgId,
        registrationId,
        document.fieldKey,
        document.name,
        document.contentType,
        document.bytes.byteLength,
        Buffer.from(document.bytes),
        actor.userId,
      ],
    );
  }
}

/**
 * Sets a document's review. The function (migration 0061) updates the file and the answer that names it together, and checks the
 * caller's role itself. Audited without the file's name or contents.
 */
export async function setDocumentReviewInTx(
  db: Db,
  actor: Actor,
  fileId: string,
  status: DocumentReviewStatus,
): Promise<void> {
  try {
    await db.query('SELECT buxa_set_document_review_v1($1, $2, $3)', [actor.orgId, fileId, status]);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'P0002') {
      throw new RegistrationFileNotFoundError();
    }
    throw error;
  }
  await recordAudit(db, {
    actor,
    action: 'registration.document_review',
    entity: 'registration_file',
    entityId: fileId,
    data: { status },
  });
}
