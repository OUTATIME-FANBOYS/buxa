import { Icon } from '../../../../elements';
import { type Tone } from '../../../../logic/common';

export interface StatCardProps { label: string; value: number | string; note?: string; tone?: Tone; icon?: string; strong?: boolean }

/** One number in the stats row, in one palette tone. */
export function StatCard({ label, value, note, tone = 'neutral', icon, strong }: StatCardProps) {
  return (
    <div className={`stat tone-${tone} ${strong ? 'stat-strong' : ''}`}>
      <span className="stat-top"><span className="stat-label">{label}</span>{icon && <span className="stat-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>}</span>
      <span className="stat-num">{value}</span>{note && <span className="muted small">{note}</span>}
    </div>
  );
}
