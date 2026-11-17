import type { AccessStatus } from '@buxa/domain';
import { Pill } from '@/components/elements/export';
import { ACCESS_LABEL, ACCESS_TONE } from '@buxa/shared';

/** A membership status as a pill: the words are the meaning, the colour only reinforces them. Renders nothing when withheld (null). */
export function AccessPill({ status }: { status: AccessStatus | null }) {
  if (status === null) {
    return null;
  }

  return <Pill tone={ACCESS_TONE[status]}>{ACCESS_LABEL[status]}</Pill>;
}
