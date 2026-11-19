import { useId } from 'react';
import { type ChartTone } from '@/components/elements';
import { smoothPath, type Point } from './smoothPath';

/**
 * A small smooth line through a series, with a soft area fading to the card underneath. No axes: the number beside it gives the
 * total, and the table or summary next to the card gives the rest. Colours come from the tone classes in charts.css.
 */
export function Sparkline({
  values,
  ariaLabel,
  tone = 'brand',
  width = 96,
  height = 40,
}: {
  values: number[];
  ariaLabel: string;
  tone?: ChartTone;
  width?: number;
  height?: number;
}) {
  const gid = `spark-${useId().replace(/:/g, '')}`;
  const pad = 4;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points: Point[] = values.map((v, i) => [
    values.length > 1 ? i * step : width / 2,
    height - pad - ((v - min) / span) * (height - 2 * pad),
  ]);
  const line = smoothPath(points);
  const area = line ? `${line} L${width},${height} L0,${height} Z` : '';

  return (
    <svg
      className={`sparkline chart-tone-${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop className="chart-area-top" offset="0" />
          <stop className="chart-area-bottom" offset="1" />
        </linearGradient>
      </defs>
      {area && <path className="sparkline-area" d={area} fill={`url(#${gid})`} />}
      {line && <path className="sparkline-line" d={line} fill="none" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
