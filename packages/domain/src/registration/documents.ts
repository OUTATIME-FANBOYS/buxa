/*
 * Document questions and form attachments. Pure rules, no I/O: the closed sets, the size limit and the check of what a file really
 * is. The contract (packages/contracts) and the database both read these values; the browser's file type is never trusted.
 */

/** The review a staff member gives a family's document. A document is pending until staff check it. */
export const DOCUMENT_REVIEW_STATUSES = ['pending', 'accepted', 'needs_replacing'] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];

/** What staff see for a document question: a review, or no document at all when a required one is missing. */
export const DOCUMENT_STATUSES = ['not_received', ...DOCUMENT_REVIEW_STATUSES] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * The most a single uploaded file may be: 1 MB, the same limit as the attachments on a staff task (useAttachmentUpload). One limit
 * for every file the app stores, so a file that one screen refuses is refused everywhere.
 */
export const ATTACHMENT_MAX_BYTES = 1024 * 1024;

/** The types a file may have. PDF and the common image types; anything else is refused. */
export const ATTACHMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number];

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/**
 * The type a file's first bytes say it is (its magic number), or null when it is none of the accepted types. The file name and the
 * browser's type are not used: a renamed file of another type is refused.
 */
export function sniffAttachmentType(bytes: Uint8Array): AttachmentContentType | null {
  // %PDF-
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }

  return null;
}

/**
 * The status a document question shows. A stored answer carries its review; no answer means the family sent nothing. Only a
 * required question is "not received": an optional one that was left empty has nothing to show.
 */
export function documentStatusOf(
  answer: { status: DocumentReviewStatus } | undefined,
  required: boolean,
): DocumentStatus | null {
  if (answer) {
    return answer.status;
  }

  return required ? 'not_received' : null;
}
