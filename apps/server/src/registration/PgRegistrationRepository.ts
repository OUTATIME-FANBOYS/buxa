import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { PgCredentialRepository, transactionScope } from '../credentials/PgCredentialRepository';
import type { Actor } from '@buxa/domain';
import type { RegistrationForm, RegistrationFormInput, RegistrationRow } from '@buxa/contracts';
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
  insertForm,
  insertRegistrationInTx,
  publishFormRow,
  updateFormRow,
} from './PgRegistrationWrites';
import type {
  ConfirmationRule,
  ConfirmationWork,
  NewRegistration,
  PublishedVersion,
  RegistrationRepository,
  RegistrationRule,
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

  createForm(actor: Actor, input: RegistrationFormInput): Promise<RegistrationForm> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await insertForm(db, actor, input);

      return requireFormRow(db, id);
    });
  }

  updateForm(actor: Actor, formId: string, input: RegistrationFormInput): Promise<RegistrationForm> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await updateFormRow(db, actor, formId, input);

      return requireFormRow(db, formId);
    });
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
}
