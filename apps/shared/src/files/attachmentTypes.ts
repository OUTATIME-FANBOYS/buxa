import { ATTACHMENT_CONTENT_TYPES, ATTACHMENT_MAX_BYTES } from '@buxa/domain';

/** The most one uploaded file may be. Staff task attachments and family documents share it (see ATTACHMENT_MAX_BYTES in @buxa/domain). */
export { ATTACHMENT_MAX_BYTES };

/** The `accept` value for a file input that takes a document: the same types the server accepts (PDF and the common images). */
export const ATTACHMENT_ACCEPT: string = ATTACHMENT_CONTENT_TYPES.join(',');

/** A short label for the accepted types, for the helper text under a file input. */
export const ATTACHMENT_HINT = `PDF, JPEG, PNG or WebP, up to ${ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB.`;
