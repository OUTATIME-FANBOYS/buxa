import type { ReactNode } from 'react';
import type { RoleTone, Tone } from '@buxa/shared';

// The tone classes (pill-brand, pill-ok ...) only set the tone's colour steps in tokens.css; the layout and colours live here.
// Every pill has a thin border in its text colour, so it reads as a pill on any surface.
const PILL =
  'buxa:inline-flex buxa:items-center buxa:gap-[6px] buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:leading-[20px] buxa:tracking-normal buxa:px-[8px] buxa:rounded-[10px] buxa:whitespace-nowrap buxa:bg-[var(--tone-soft)] buxa:text-[var(--tone-ink)] buxa:border buxa:border-current';
const PILL_DOT = 'buxa:h-[6px] buxa:w-[6px] buxa:flex-none buxa:rounded-full buxa:bg-[var(--tone-f)]';

export function Pill({
  tone = 'neutral',
  children,
  dot = true,
}: {
  tone?: Tone | RoleTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`pill pill-${tone} ${PILL}`}>
      {dot && <i className={`pill-dot ${PILL_DOT}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
