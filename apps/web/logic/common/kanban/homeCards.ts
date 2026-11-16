import type { Tone } from '../tones';
import type { CampHome } from '../../../features/camp/lib/campHome';
import type { TaskCounts } from './homeTasks';

export interface HomeCard { label: string; value: number; note: string; tone: Tone; icon: string; strong?: boolean }

/**
 * The one stats row: camp facts the viewer may see first, then the task counts. Pure, so the mix is tested without rendering.
 * A camp fact the viewer may not read (null) gets no card at all.
 */
export function homeCards(camp: CampHome | null, tasks: TaskCounts): HomeCard[] {
  const pct = tasks.total ? Math.round((tasks.completed / tasks.total) * 100) : 0;
  const facts: HomeCard[] = camp === null ? [] : [
    ...(camp.people === null ? [] : [{ label: 'People', value: camp.people, note: 'on the camp list', tone: 'brand' as const, icon: 'users' }]),
    ...(camp.onSite === null ? [] : [{ label: 'On site now', value: camp.onSite, note: 'checked in right now', tone: 'ok' as const, icon: 'clock' }]),
    ...(camp.validMemberships === null ? [] : [{ label: 'Valid memberships', value: camp.validMemberships, note: 'valid today', tone: 'neutral' as const, icon: 'check' }]),
  ];
  const work: HomeCard[] = [
    { label: 'Total tasks', value: tasks.total, note: 'in this workspace', tone: 'hero', icon: 'tasks' },
    { label: 'In progress', value: tasks.inProgress, note: 'being worked on', tone: 'brand', icon: 'timeline' },
    { label: 'Completed', value: tasks.completed, note: `${pct}% of tasks`, tone: 'ok', icon: 'check' },
    {
      label: 'Overdue', value: tasks.overdue, note: tasks.overdue ? 'past their due date' : 'all on schedule',
      tone: tasks.overdue ? 'crit' : 'ok', icon: tasks.overdue ? 'alert' : 'check', strong: tasks.overdue > 0,
    },
  ];
  return [...facts, ...work];
}
