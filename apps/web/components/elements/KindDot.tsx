import type { Column } from '@buxa/shared';

// The column kind's dot: neutral for an open column, brand for an active one, green for a done one.
const KIND_DOT: Record<Column['kind'], string> = {
  open: 'buxa:bg-[var(--f-neutral)]',
  active: 'buxa:bg-[var(--f-brand)]',
  done: 'buxa:bg-[var(--f-ok)]',
};
const DOT = 'buxa:inline-block buxa:h-[8px] buxa:w-[8px] buxa:flex-none buxa:rounded-full';

export function KindDot({ kind, className = '' }: { kind: Column['kind']; className?: string }) {
  return <i className={`kind-dot kind-${kind} ${DOT} ${KIND_DOT[kind]} ${className}`.trim()} aria-hidden="true" />;
}
