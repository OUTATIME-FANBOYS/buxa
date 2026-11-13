import type { ChartTone } from './tone';

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
