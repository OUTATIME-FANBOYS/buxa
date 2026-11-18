import type { ReactNode } from 'react';
import type { RoleTone, Tone } from '@buxa/shared';

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
    <span className={`pill pill-${tone}`}>
      {dot && <i className="pill-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
