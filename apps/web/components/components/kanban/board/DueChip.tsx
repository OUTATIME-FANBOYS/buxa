import { Icon } from '@/components/elements';
import { dueInfo } from '@buxa/shared';

// The chip's colours by tone: overdue and soon get a tinted background, done only a colour. Normal uses the default text colour.
const TONE: Record<string, string> = {
  overdue: 'buxa:text-[var(--crit-ink)] buxa:bg-[var(--crit-soft)]',
  soon: 'buxa:text-[var(--warn-ink)] buxa:bg-[var(--warn-soft)]',
  done: 'buxa:text-[var(--ok)]',
};
const DUE =
  'buxa:inline-flex buxa:items-center buxa:gap-[4px] buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:rounded-full buxa:border buxa:border-current buxa:pt-[1px] buxa:pr-[6px] buxa:pb-[1px] buxa:pl-[4px] buxa:leading-[18px]';

export const DueChip = ({ due, kind }: { due?: string; kind: 'open' | 'active' | 'done' }) => {
  const d = dueInfo(due, kind);
  if (!d) {
    return null;
  }

  return (
    <span className={`due due-${d.tone} ${DUE} ${TONE[d.tone] ?? 'buxa:text-[var(--text-2)]'}`}>
      <Icon name={d.tone === 'done' ? 'check' : 'clock'} size={12} />
      {d.label}
    </span>
  );
};
