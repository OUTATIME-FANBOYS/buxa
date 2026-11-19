import type { ReactNode } from 'react';
import type { RoleTone, Tone } from '@buxa/shared';

// The tone class (tone-ok, tone-role-owner ...) sets the tone's hue in tokens.css; the glass look and the size are in
// components/pill.css, so every pill shares them.
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
    <span className={`pill tone-${tone}`}>
      {dot && <i className="pill-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
