import { Icon, Pill } from '@/components/elements/export';
import { type Tone } from '@buxa/shared';

interface StatCardProps {
  label: string; value: number | string; note?: string; tone?: Tone; icon?: string; strong?: boolean;
  /** What the number counts. Shown as an info icon with a tooltip, and read by screen readers. */
  info?: string;
  /** A short coloured chip beside the number, for example "+3 vs yesterday". Its words carry the meaning, not its colour. */
  change?: { text: string; tone: Tone } | null;
}

/** One number in a stats row, in one palette tone. */
export function StatCard({ label, value, note, tone = 'neutral', icon, strong, info, change }: StatCardProps) {
  return (
    <div className={`stat tone-${tone} ${strong ? 'stat-strong' : ''}`}>
      <span className="stat-top">
        <span className="stat-label">{label}</span>
        {info && <span className="stat-info" title={info}><Icon name="info" size={14} /><span className="sr-only">{info}</span></span>}
        {!info && icon && <span className="stat-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>}
      </span>
      <span className="stat-num">{value}</span>
      {change ? <span className="stat-change"><Pill tone={change.tone}>{change.text}</Pill></span> : note && <span className="muted small">{note}</span>}
    </div>
  );
}
