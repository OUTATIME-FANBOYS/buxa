import type { AccessStatus } from '@buxa/domain';
import type { Tone } from '@/components/ui';

/** The one place a membership status gets its words and colour. Colour always comes with the words (WCAG AA, no colour-only status). */
export const ACCESS_LABEL: Readonly<Record<AccessStatus, string>> = {
  valid: 'Valid',
  not_started: 'Not started',
  expired: 'Expired',
  revoked: 'Revoked',
  none: 'No membership',
};

export const ACCESS_TONE: Readonly<Record<AccessStatus, Tone>> = {
  valid: 'ok',
  not_started: 'brand',
  expired: 'warn',
  revoked: 'crit',
  none: 'neutral',
};
