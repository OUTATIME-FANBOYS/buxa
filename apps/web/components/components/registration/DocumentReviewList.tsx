'use client';

import { useActionState } from 'react';
import type { RegistrationDocument } from '@buxa/contracts';
import { DOCUMENT_REVIEW_OPTIONS, DOCUMENT_STATUS_LABEL, idle } from '@buxa/shared';
import { Button } from '@/components/elements';
import { registrationDocumentPath } from '@/config/routes';
import { reviewDocumentAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

/*
 * The document questions of one registration, for staff: each with its status, the file to open, and a review. A question with no
 * file says Not received and has nothing to review.
 */
export function DocumentReviewList({
  formId,
  documents,
}: {
  formId: string;
  documents: readonly RegistrationDocument[];
}) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <ul className="document-review" aria-label="Documents">
      {documents.map(document => (
        <DocumentReviewRow key={document.fieldKey} formId={formId} document={document} />
      ))}
    </ul>
  );
}

function DocumentReviewRow({ formId, document }: { formId: string; document: RegistrationDocument }) {
  const [state, review, pending] = useActionState(reviewDocumentAction, idle);
  const selectId = `review-${document.fileId ?? document.fieldKey}`;

  return (
    <li className="document-review__item">
      <span className="document-review__label">{document.label}</span>
      {document.fileId && document.fileName ? (
        <a className="document-review__file" href={registrationDocumentPath(document.fileId)}>
          {document.fileName}
        </a>
      ) : (
        <span className="muted">Nothing sent</span>
      )}
      <span className="document-review__status">{DOCUMENT_STATUS_LABEL[document.status]}</span>
      {document.fileId && (
        <form action={review} className="document-review__form">
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="fileId" value={document.fileId} />
          <label className="document-review__select" htmlFor={selectId}>
            <span className="muted">Review</span>
            <select id={selectId} name="status" defaultValue={document.status} disabled={pending}>
              {DOCUMENT_REVIEW_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="glass" disabled={pending}>
            {pending ? 'Saving...' : 'Save review'}
          </Button>
          <ActionMessage state={state} />
        </form>
      )}
    </li>
  );
}
