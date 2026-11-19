import type { Column } from '@buxa/shared';
import { statusMark } from './drawer/statusMark';

/**
 * A status as a liquid-glass pill: the status's emoji, then its name. The colour comes from the one status map (statusMark),
 * so the pill, the status field and any later surface stay the same colour.
 */
export function StatusPill({ column }: { column: Column }) {
  const mark = statusMark(column);

  return (
    <span className={`status-pill status-${mark.colour}`}>
      <span aria-hidden="true">{mark.emoji}</span>
      {column.name}
    </span>
  );
}
