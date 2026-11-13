import type { ChartTone } from './tone';

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
