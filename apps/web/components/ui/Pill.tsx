import type { ReactNode } from 'react';
import type { Tone } from './tones';

export function Pill({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`pill pill-${tone}`}>{dot && <i className="pill-dot" aria-hidden="true" />}{children}</span>;
}
