import { Icon, Pill } from '@/components/elements';
import { type Tone } from '@buxa/shared';
import { Sparkline } from '@/components/components/charts/Sparkline';

interface StatCardProps {
  label: string;
  value: number | string;
  note?: string;
  tone?: Tone;
  icon?: string;
  strong?: boolean;
  /** A short coloured chip at the top right of the card, for example "+3 vs yesterday". Its words carry the meaning, not its colour. */
  change?: { text: string; tone: Tone } | null;
  /** The series behind the number, drawn as a small smooth line on the right. Only given when the app has the data for it. */
  spark?: { values: number[]; ariaLabel: string };
}

/** One number in a stats row, in one palette tone. */
export function StatCard({ label, value, note, tone = 'neutral', icon, strong, change, spark }: StatCardProps) {
  return (
    <div className={`stat tone-${tone} ${strong ? 'stat-strong' : ''} ${spark ? 'has-spark' : ''}`}>
      <span className="stat-top">
        <span className="stat-label">{label}</span>
        {change ? (
          <span className="stat-change">
            <Pill tone={change.tone}>{change.text}</Pill>
          </span>
        ) : (
          icon && (
            <span className="stat-icon" aria-hidden="true">
              <Icon name={icon} size={16} />
            </span>
          )
        )}
      </span>
      <span className="stat-num">{value}</span>
      {spark && (
        <span className="stat-spark">
          <Sparkline values={spark.values} ariaLabel={spark.ariaLabel} tone={tone} />
        </span>
      )}
      {note && <span className="muted small">{note}</span>}
    </div>
  );
}
