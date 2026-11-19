import type { Priority } from '@buxa/shared';
import { PRIORITY_LABEL } from '@buxa/shared';
import { PriorityIcon } from '@/components/atoms/Icon';

// Each priority sets the colour of its label (--pc); the icon takes its own priority token.
const PRIORITY_COLOUR: Record<Priority, string> = {
  low: 'buxa:[--pc:var(--p-low)]',
  medium: 'buxa:[--pc:var(--p-medium)]',
  high: 'buxa:[--pc:var(--p-high)]',
  critical: 'buxa:[--pc:var(--p-critical)]',
};
const PRIO =
  'buxa:inline-flex buxa:items-center buxa:gap-[6px] buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--pc)]';

export function PriorityMark({
  priority,
  label = false,
  className = '',
}: {
  priority: Priority;
  label?: boolean;
  /** Extra classes for the mark, for a screen that places it (the task form's priority field). */
  className?: string;
}) {
  return (
    <span
      className={`prio prio-${priority} ${PRIORITY_COLOUR[priority]} ${PRIO} ${className}`}
      title={`${PRIORITY_LABEL[priority]} priority`}
    >
      <PriorityIcon priority={priority} size={14} />
      {label ? (
        <span>{PRIORITY_LABEL[priority]}</span>
      ) : (
        <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>
      )}
    </span>
  );
}
