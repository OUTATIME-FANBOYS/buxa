import type { ReactNode } from 'react';
import type { ChartTone } from './chartTone';

/** One slice of a ring with several parts: its size in any unit, and the tone it is filled with. */
export interface RingSegment {
  value: number;
  tone: ChartTone;
}

interface Arc {
  key: number;
  tone: ChartTone;
  dash: number;
  offset: number;
}

/** Each non-empty slice as an arc, in order, sized by its share of the total. `length` is the ring's circumference. */
function arcsFor(segments: RingSegment[], length: number): Arc[] {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const arcs: Arc[] = [];
  let start = 0;
  segments.forEach((s, key) => {
    if (s.value <= 0 || total <= 0) {
      return;
    }
    const dash = (s.value / total) * length;
    arcs.push({ key, tone: s.tone, dash, offset: start });
    start += dash;
  });

  return arcs;
}

/**
 * A circular gauge. With `value` (0 to 100) it fills one round-capped arc to that percentage, with the percentage and `label` in the
 * centre. With `segments` it draws each part as a slice of the whole ring; pass `centre` to say what the ring totals, and `summary`
 * for the screen-reader description.
 */
export function Ring({
  value = 0,
  segments,
  size = 132,
  stroke = 10,
  label,
  tone = 'brand',
  summary,
  centre,
}: {
  value?: number;
  segments?: RingSegment[];
  size?: number;
  stroke?: number;
  label: string;
  tone?: ChartTone;
  summary?: string;
  centre?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const arcs: Arc[] = segments ? arcsFor(segments, c) : [{ key: 0, tone, dash: (v / 100) * c, offset: 0 }];

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={summary ?? `${label}: ${Math.round(v)} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {arcs.map(arc => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`var(--f-${arc.tone})`}
            strokeWidth={stroke}
            strokeLinecap={segments ? 'butt' : 'round'}
            strokeDasharray={`${arc.dash} ${c}`}
            strokeDashoffset={segments ? -arc.offset : undefined}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <div className="ring-text">
        {centre ?? (
          <>
            <span className="stat-num">{Math.round(v)}%</span>
            <span className="muted small">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}
