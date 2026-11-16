import type { AccessStatus } from '@buxa/domain';
import { Pill } from '@/components/ui';
import { ACCESS_LABEL, ACCESS_TONE } from '../lib/status';

/** A membership status as a pill: the words are the meaning, the colour only reinforces them. */
export function AccessPill({ status }: { status: AccessStatus }) {
  return <Pill tone={ACCESS_TONE[status]}>{ACCESS_LABEL[status]}</Pill>;
}
