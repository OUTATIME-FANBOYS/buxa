import type { Tone } from '../tones';
import type { CampHome, CheckInsByDay } from '../camp/campHomeTypes';

export interface HomeCardChange { text: string; tone: Tone }
/** One number on the Home stats row. `change` is a short chip (for example "+3 vs yesterday"), or null when there is nothing honest to compare. */
export interface HomeCard { label: string; value: number; info: string; icon: string; tone: Tone; change: HomeCardChange | null }

/** Today against yesterday, from the chart's days. Only when both days are complete, so the comparison is not against a short count. */
export function dayChange(series: CheckInsByDay | null): HomeCardChange | null {
  if (!series || !series.complete || series.days.length < 2) {
    return null;
  }
  const today = series.days[series.days.length - 1].count;
  const yesterday = series.days[series.days.length - 2].count;
  const diff = today - yesterday;
  if (diff === 0) {
    return { text: 'Same as yesterday', tone: 'neutral' };
  }

  return diff > 0 ? { text: `+${diff} vs yesterday`, tone: 'ok' } : { text: `${diff} vs yesterday`, tone: 'warn' };
}

/**
 * The three cards on Home's stats row: the camp facts the viewer may see. A fact the viewer may not read (null) gets no card.
 * Pure, so the values and chips are tested without rendering.
 */
export function homeCards(camp: CampHome): HomeCard[] {
  const share: HomeCardChange | null = camp.validMemberships !== null && camp.people
    ? { text: `${Math.round((camp.validMemberships / camp.people) * 100)}% of people`, tone: 'neutral' }
    : null;

  return [
    ...(camp.onSite === null ? [] : [{
      label: 'On site now', value: camp.onSite, icon: 'clock', tone: 'ok' as const,
      info: 'People checked in right now who have not checked out.', change: { text: 'Live', tone: 'ok' as const },
    }]),
    ...(camp.checkedInToday === null ? [] : [{
      label: 'Checked in today', value: camp.checkedInToday, icon: 'check', tone: 'brand' as const,
      info: 'People who checked in at any time today, in camp time.', change: dayChange(camp.checkInsByDay),
    }]),
    ...(camp.validMemberships === null ? [] : [{
      label: 'Valid memberships', value: camp.validMemberships, icon: 'check', tone: 'neutral' as const,
      info: 'People whose membership is valid today.', change: share,
    }]),
  ];
}
