import { Icon, Pill } from '@/components/elements';
import type { Tone } from '@buxa/shared';
import { dueInfo, type DueTone } from '@buxa/shared';

// The due date as the shared glass pill, coloured by state: overdue and yesterday red, today and tomorrow orange, a later date
// neutral, a finished task green.
const TONE: Record<DueTone, Tone> = { overdue: 'crit', soon: 'warn', normal: 'neutral', done: 'ok' };

export const DueChip = ({ due, kind }: { due?: string; kind: 'open' | 'active' | 'done' }) => {
  const d = dueInfo(due, kind);
  if (!d) {
    return null;
  }

  return (
    <Pill tone={TONE[d.tone]} dot={false} className="due">
      <Icon name={d.tone === 'done' ? 'check' : 'clock'} size={12} />
      {d.label}
    </Pill>
  );
};
