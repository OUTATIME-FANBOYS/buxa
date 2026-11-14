import type { AccessStatus } from '@buxa/domain';
import { Pill } from '@/components/ui';
import { STATUS_DISPLAY } from '../lib/status';

/** A status as a pill: the words are the meaning, the colour only repeats it. */
export function StatusPill({ status }: { status: AccessStatus }) {
  const { label, tone } = STATUS_DISPLAY[status];
  return <Pill tone={tone}>{label}</Pill>;
}
