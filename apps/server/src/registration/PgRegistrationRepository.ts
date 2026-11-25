import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { PgCredentialRepository, transactionScope } from '../credentials/PgCredentialRepository';
import type { Actor, DocumentReviewStatus } from '@buxa/domain';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import {
  documentInTx,
  formFileInTx,
  insertFormFilesInTx,
  removeFormFileInTx,
  setDocumentReviewInTx,
} from './PgRegistrationFiles';
import {
  getFormRow,
  listFormRows,
  listSubmissionRows,
  publishedVersionRow,
  requireFormRow,
} from './PgRegistrationQueries';
import {
  camperIdsInTx,
  confirmRegistrationInTx,
  deleteFormInTx,
  insertForm,
  insertRegistrationInTx,
  publishFormRow,
  updateFormRow,
} from './PgRegistrationWrites';
import { classLookupsInTx, recordPaymentInTx } from './PgRegistrationPlaces';
import {
  eraseRegistrationInTx,
  setRegistrationArchivedInTx,
  withdrawRegistrationInTx,
} from './PgRegistrationLifecycle';
import type {
  ClassLookup,
  ConfirmationRule,
  ConfirmationWork,
  ErasureRule,
  FileDownload,
  FormDeletionRule,
  NewRegistration,
  StoredFileInput,
  PublishedVersion,
  RegistrationRepository,
  RegistrationFormWrite,
  RegistrationRule,
  WithdrawalRule,
} from './RegistrationRepository';

/**
 * Postgres adapter for registration forms and submissions. Every call runs in withOrg (row-level security), and every write
 * audits itself in the same transaction. Refusals are thrown inside the transaction, so nothing is written for them.
 */
export class PgRegistrationRepository implements RegistrationRepository {
  constructor(private readonly pool: Pool) {}

  listForms(userId: string, orgId: string): Promise<RegistrationForm[]> {
    return withOrg(this.pool, userId, orgId, listFormRows);
  }

  getForm(userId: string, orgId: string, formId: string): Promise<RegistrationForm | null> {
    return withOrg(this.pool, userId, orgId, db => getFormRow(db, formId));
  }

  getPublishedVersion(userId: string, orgId: string, formId: string): Promise<PublishedVersion | null> {
    return withOrg(this.pool, userId, orgId, db => publishedVersionRow(db, formId));
  }

  createForm(actor: Actor, input: RegistrationFormWrite, files: readonly StoredFileInput[]): Promise<RegistrationForm> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await insertForm(db, actor, input);
      await insertFormFilesInTx(db, actor, id, files);

      return requireFormRow(db, id);
    });
  }

  updateForm(
    actor: Actor,
    formId: string,
    input: RegistrationFormWrite,
    files: readonly StoredFileInput[],
  ): Promise<RegistrationForm> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await updateFormRow(db, actor, formId, input);
      await insertFormFilesInTx(db, actor, formId, files);

      return requireFormRow(db, formId);
    });
  }

  removeFormFile(actor: Actor, formId: string, fileId: string): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => removeFormFileInTx(db, actor, formId, fileId));
  }

  deleteForm(actor: Actor, formId: string, rule: FormDeletionRule): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => deleteFormInTx(db, actor, formId, rule));
  }

  formFileDownload(userId: string, orgId: string, fileId: string, sessionId: string): Promise<FileDownload | null> {
    return withOrg(this.pool, userId, orgId, db => formFileInTx(db, fileId, sessionId));
  }

  documentDownload(userId: string, orgId: string, fileId: string): Promise<FileDownload | null> {
    return withOrg(this.pool, userId, orgId, db => documentInTx(db, fileId));
  }

  setDocumentReview(actor: Actor, fileId: string, status: DocumentReviewStatus): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => setDocumentReviewInTx(db, actor, fileId, status));
  }

  publishForm(actor: Actor, formId: string): Promise<RegistrationForm> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await publishFormRow(db, actor, formId);

      return requireFormRow(db, formId);
    });
  }

  listSubmissions(userId: string, orgId: string, formId: string): Promise<RegistrationRow[]> {
    return withOrg(this.pool, userId, orgId, db => listSubmissionRows(db, formId));
  }

  classesFor(userId: string, orgId: string, classIds: readonly string[]): Promise<ClassLookup[]> {
    return withOrg(this.pool, userId, orgId, db => classLookupsInTx(db, classIds));
  }

  recordPayment(
    actor: Actor,
    registrationClassId: string,
    input: { paid: boolean; note: string | null },
  ): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db =>
      recordPaymentInTx(db, actor, registrationClassId, input),
    );
  }

  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => insertRegistrationInTx(db, actor, registration, rule));
  }

  confirm<T>(actor: Actor, registrationId: string, rule: ConfirmationRule, work: ConfirmationWork<T>): Promise<T> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await confirmRegistrationInTx(db, actor, registrationId, rule);

      return work({
        campers: () => camperIdsInTx(db, registrationId),
        credentials: new PgCredentialRepository(transactionScope(db)),
      });
    });
  }

  withdraw(actor: Actor, registrationId: string, rule: WithdrawalRule): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db =>
      withdrawRegistrationInTx(db, actor, registrationId, rule),
    );
  }

  setArchived(actor: Actor, registrationId: string, archived: boolean): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db =>
      setRegistrationArchivedInTx(db, actor, registrationId, archived),
    );
  }

  erase(actor: Actor, registrationId: string, rule: ErasureRule): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => eraseRegistrationInTx(db, actor, registrationId, rule));
  }
}
