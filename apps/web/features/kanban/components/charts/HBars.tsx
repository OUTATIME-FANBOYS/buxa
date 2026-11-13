import type { ReactNode } from 'react';

export interface HRow { label: ReactNode; segments: { value: number; className: string; name: string }[]; total?: number }

export function HBars({ rows, max, ariaLabel }: { rows: HRow[]; max?: number; ariaLabel: string }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.segments.reduce((a, s) => a + s.value, 0)));
  return (
    <ul className="hbars" aria-label={ariaLabel}>
      {rows.map((r, i) => {
        const sum = r.segments.reduce((a, s) => a + s.value, 0);
        return (
          <li key={i}>
            <span className="hb-label">{r.label}</span>
            <span className="hb-track" title={r.segments.filter(s => s.value).map(s => `${s.value} ${s.name}`).join(', ')}>
              {r.segments.filter(s => s.value > 0).map((s, j) => <span key={j} className={`hb-seg ${s.className}`} style={{ width: `${(s.value / m) * 100}%` }} />)}
            </span>
            <span className="hb-val">{sum}</span>
          </li>
        );
      })}
    </ul>
  );
}
