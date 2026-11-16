import { Icon } from '@/components/ui';
import { dueInfo } from '../../lib/tasks';

export const DueChip = ({ due, kind }: { due?: string; kind: 'open' | 'active' | 'done' }) => {
  const d = dueInfo(due, kind); if (!d) return null;
  return <span className={`due due-${d.tone}`}><Icon name={d.tone === 'done' ? 'check' : 'clock'} size={12} />{d.label}</span>;
};
