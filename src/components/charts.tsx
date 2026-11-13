import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ChartTone = 'brand' | 'ok' | 'warn' | 'crit' | 'agent' | 'neutral';
export function Ring({ value, size = 132, stroke = 10, label, tone = 'brand' }: { value: number; size?: number; stroke?: number; label: string; tone?: ChartTone }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.min(100, Math.max(0, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(--f-${tone})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-text"><span className="stat-num">{Math.round(v)}%</span><span className="muted small">{label}</span></div>
    </div>
  );
}

export interface BarDatum { label: string; value: number; title?: string; tone?: ChartTone }
export function Bars({ data, height = 176, ariaLabel, unit = 'tasks', tone = 'brand' }: { data: BarDatum[]; height?: number; ariaLabel: string; unit?: string; tone?: ChartTone }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null); const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth))); ro.observe(el); setW(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const max = Math.max(1, ...data.map(d => d.value)); const top = Math.max(2, Math.ceil(max / 2) * 2);
  const padL = 26; const padB = 22; const H = height; const plotH = H - padB - 8; const base = 8 + plotH;
  const slot = (W - padL) / data.length; const bw = Math.max(4, Math.min(22, slot * 0.62));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 80)));
  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel}>
        {[0, top / 2, top].map(t => { const y = base - (t / top) * plotH; return <g key={t}><line x1={padL} x2={W} y1={y} y2={y} stroke="var(--grid)" /><text x={0} y={y + 4} className="axis">{t}</text></g>; })}
        {data.map((d, i) => {
          const h = (d.value / top) * plotH; const x = padL + i * slot + (slot - bw) / 2; const y = base - h; const r = Math.min(4, h / 2, bw / 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * slot} y={0} width={slot} height={H - padB + 6} fill="transparent" />
              {d.value > 0 && <path d={`M${x},${base} V${y + r} a${r},${r} 0 0 1 ${r},${-r} H${x + bw - r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`} fill={`var(--f-${d.tone ?? tone})`} opacity={hover === null || hover === i ? 1 : 0.4} />}
              {i % every === 0 && <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="axis">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && <div className="tip" style={{ left: Math.min(W - 70, Math.max(70, padL + hover * slot + slot / 2)) }}><strong>{data[hover].value}</strong> {unit}<span>{data[hover].title ?? data[hover].label}</span></div>}
    </div>
  );
}

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

export function Legend({ items }: { items: { name: string; className: string }[] }) {
  return <div className="legend">{items.map(i => <span key={i.name}><i className={`sw ${i.className}`} />{i.name}</span>)}</div>;
}

/** One stacked bar that splits a whole into labelled parts. Every part is named with its count, so colour is never the only cue. */
export function StatusBar({ parts, ariaLabel }: { parts: { name: string; value: number; tone: ChartTone }[]; ariaLabel: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="statusbar" role="img" aria-label={`${ariaLabel}: ${parts.map(p => `${p.value} ${p.name}`).join(', ')}`}>
      <div className="sb-track">{parts.filter(p => p.value > 0).map(p => <span key={p.name} className={`sb-seg seg-${p.tone}`} style={{ flexGrow: p.value }} title={`${p.value} ${p.name}`} />)}</div>
      <ul className="sb-legend" aria-hidden="true">{parts.map(p => (
        <li key={p.name}><i className={`sw seg-${p.tone}`} /><span className="muted">{p.name}</span><strong>{p.value}</strong><span className="muted small">{total ? Math.round((p.value / total) * 100) : 0}%</span></li>))}</ul>
    </div>
  );
}
