import type { AccessStatus } from '@buxa/domain';
import { Pill } from '@/elements/export';
import { STATUS_DISPLAY } from '@/logic/common';

/** A status as a pill: the words are the meaning, the colour only repeats it. */
export function StatusPill({ status }: { status: AccessStatus | null }) {
  if (status === null) return null;
  const { label, tone } = STATUS_DISPLAY[status];
  return <Pill tone={tone}>{label}</Pill>;
}
