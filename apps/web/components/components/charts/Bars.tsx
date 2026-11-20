'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { type ChartTone } from '@/components/elements';

interface BarDatum {
  label: string;
  value: number;
  title?: string;
  tone?: ChartTone;
}

/** Width of the element, tracked as it resizes (a floor keeps the plot readable). */
function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(240, el.clientWidth));

    return () => ro.disconnect();
  }, [ref]);

  return W;
}

/**
 * Columns with soft rounded tops, each filled with a gradient from its tone (strong at the top, fading toward the base). Thin dashed
 * guide lines sit behind them; the value is in the tooltip and the table beside the chart, so the axis numbers are not drawn.
 */
export function Bars({
  data,
  height = 176,
  ariaLabel,
  unit = 'tasks',
  tone = 'brand',
}: {
  data: BarDatum[];
  height?: number;
  ariaLabel: string;
  unit?: string;
  tone?: ChartTone;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap);
  const gid = `bars-${useId().replace(/:/g, '')}`;
  const max = Math.max(1, ...data.map(d => d.value));
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const padL = 4;
  const padB = 22;
  const H = height;
  const plotH = H - padB - 8;
  const base = 8 + plotH;
  const slot = (W - padL) / data.length;
  const bw = Math.max(4, Math.min(22, slot * 0.62));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 80)));
  const tones = [...new Set(data.map(d => d.tone ?? tone))];

  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel}>
        <defs>
          {tones.map(t => (
            <linearGradient key={t} id={`${gid}-${t}`} x1="0" y1="0" x2="0" y2="1" className={`chart-tone-${t}`}>
              <stop className="chart-bar-top" offset="0" />
              <stop className="chart-bar-bottom" offset="1" />
            </linearGradient>
          ))}
        </defs>
        {[0, top / 2, top].map(t => {
          const y = base - (t / top) * plotH;

          return <line key={t} className="chart-guide" x1={padL} x2={W} y1={y} y2={y} />;
        })}
        {data.map((d, i) => {
          const h = (d.value / top) * plotH;
          const x = padL + i * slot + (slot - bw) / 2;
          const y = base - h;
          const r = Math.min(8, h / 2, bw / 2);
          const t = d.tone ?? tone;

          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * slot} y={0} width={slot} height={H - padB + 6} fill="transparent" />
              {d.value > 0 && (
                <path
                  className="chart-bar"
                  d={`M${x},${base} V${y + r} a${r},${r} 0 0 1 ${r},${-r} H${x + bw - r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`}
                  fill={`url(#${gid}-${t})`}
                  opacity={hover === null || hover === i ? 1 : 0.4}
                />
              )}
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="axis">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: Math.min(W - 70, Math.max(70, padL + hover * slot + slot / 2)) }}>
          <strong>{data[hover].value}</strong> {unit}
          <span>{data[hover].title ?? data[hover].label}</span>
        </div>
      )}
    </div>
  );
}
