import type { AccessStatus } from '@buxa/domain';
import type { Tone } from '@/components/ui/tones';

/**
 * A membership status in words and colour. The words carry the meaning; the tone only reinforces it. Pills use the token pairs
 * checked for WCAG AA in styles/tokens.css.
 */
export const STATUS_DISPLAY: Readonly<Record<AccessStatus, { label: string; tone: Tone }>> = {
  valid: { label: 'Valid', tone: 'ok' },
  not_started: { label: 'Not started yet', tone: 'warn' },
  expired: { label: 'Expired', tone: 'crit' },
  revoked: { label: 'Revoked', tone: 'crit' },
  none: { label: 'No membership', tone: 'neutral' },
};
