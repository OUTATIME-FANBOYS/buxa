import type { CheckInMethod } from '@buxa/contracts';

/** How a check-in was made, in the words the log shows. */
export const METHOD_LABEL: Readonly<Record<CheckInMethod, string>> = { qr: 'Badge', search: 'Name', manual: 'Manual' };
