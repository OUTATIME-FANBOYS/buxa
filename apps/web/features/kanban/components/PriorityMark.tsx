import type { Priority } from '../types';
import { PRIORITIES, PRIORITY_LABEL } from '../lib/tasks';

export function PriorityMark({ priority, label = false }: { priority: Priority; label?: boolean }) {
  const n = PRIORITIES.indexOf(priority) + 1;
  return (
    <span className={`prio prio-${priority}`} title={`${PRIORITY_LABEL[priority]} priority`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <rect key={i} x={1 + i * 3.4} y={10 - i * 2.6} width="2.2" height={3 + i * 2.6} rx="1" opacity={i < n ? 1 : 0.22} fill="currentColor" />)}
      </svg>
      {label ? <span>{PRIORITY_LABEL[priority]}</span> : <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>}
    </span>
  );
}
