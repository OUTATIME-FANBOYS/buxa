import { DOCUMENT_REVIEW_STATUSES, type DocumentReviewStatus, type DocumentStatus } from '@buxa/domain';

/** The words staff and families see for a document's status. One place, so a screen never invents its own. */
export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  not_received: 'Not received',
  pending: 'Pending',
  accepted: 'Accepted',
  needs_replacing: 'Needs replacing',
};

/** The reviews staff can give a document that was sent, in the order the select shows them. */
export const DOCUMENT_REVIEW_OPTIONS: { value: DocumentReviewStatus; label: string }[] = DOCUMENT_REVIEW_STATUSES.map(
  value => ({ value, label: DOCUMENT_STATUS_LABEL[value] }),
);
