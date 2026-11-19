import type { Column } from '@buxa/shared';
import { StatusIcon } from '@/components/atoms/Icon';
import { statusMark } from './drawer';

/**
 * A status as a liquid-glass pill: its line icon, then its name. The colour and icon come from the one status map (statusMark),
 * so the pill, the status field and any later surface stay the same.
 */
export function StatusPill({ column }: { column: Column }) {
  const mark = statusMark(column);

  return (
    <span className={`status-pill status-${mark.colour}`}>
      <StatusIcon glyph={mark.glyph} size={14} />
      {column.name}
    </span>
  );
}
