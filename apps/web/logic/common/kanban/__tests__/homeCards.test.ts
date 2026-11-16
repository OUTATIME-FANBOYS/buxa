import { describe, expect, it } from 'vitest';
import type { CampHome } from '../../../../features/camp/lib/campHome';
import type { TaskCounts } from '../homeTasks';
import { homeCards } from '../homeCards';

const tasks: TaskCounts = { total: 8, inProgress: 3, completed: 2, overdue: 0 };
const camp: CampHome = { campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: true, people: 40, onSite: 12, validMemberships: 35 };

describe('homeCards', () => {
  it('mixes camp facts with task facts in one row, camp first', () => {
    const cards = homeCards(camp, tasks);
    expect(cards.map(c => c.label)).toEqual(['People', 'On site now', 'Valid memberships', 'Total tasks', 'In progress', 'Completed', 'Overdue']);
    expect(cards.map(c => c.value)).toEqual([40, 12, 35, 8, 3, 2, 0]);
  });

  it('gives every card a palette tone', () => {
    const tones = homeCards(camp, tasks).map(c => c.tone);
    expect(tones.every(t => ['neutral', 'brand', 'ok', 'warn', 'crit', 'agent', 'hero'].includes(t))).toBe(true);
  });

  it('shows only the task cards when there is no camp', () => {
    expect(homeCards(null, tasks).map(c => c.label)).toEqual(['Total tasks', 'In progress', 'Completed', 'Overdue']);
  });

  it('leaves out a camp fact the viewer may not read', () => {
    const cards = homeCards({ ...camp, people: null, onSite: null }, tasks);
    expect(cards.map(c => c.label)).toEqual(['Valid memberships', 'Total tasks', 'In progress', 'Completed', 'Overdue']);
  });

  it('turns overdue red and strong only when something is overdue', () => {
    const late = homeCards(null, { ...tasks, overdue: 2 }).find(c => c.label === 'Overdue');
    const onTime = homeCards(null, tasks).find(c => c.label === 'Overdue');
    expect(late).toMatchObject({ tone: 'crit', strong: true, note: 'past their due date' });
    expect(onTime).toMatchObject({ tone: 'ok', note: 'all on schedule' });
  });
});
