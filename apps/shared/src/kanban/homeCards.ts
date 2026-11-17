import type { Tone } from '../tones';
import type { CampHome } from '../camp/campHomeTypes';

export interface HomeCard { label: string; value: number; note: string; tone: Tone; icon: string; strong?: boolean }

/**
 * The one stats row on Home: the camp facts the viewer may see. A fact the viewer may not read (null) gets no card at all.
 * Pure, so the mix is tested without rendering.
 */
export function homeCards(camp: CampHome): HomeCard[] {
  return [
    ...(camp.people === null ? [] : [{ label: 'People', value: camp.people, note: 'on the camp list', tone: 'brand' as const, icon: 'users' }]),
    ...(camp.onSite === null ? [] : [{ label: 'On site now', value: camp.onSite, note: 'checked in right now', tone: 'ok' as const, icon: 'clock' }]),
    ...(camp.checkedInToday === null ? [] : [{ label: 'Checked in today', value: camp.checkedInToday, note: 'people today', tone: 'brand' as const, icon: 'check' }]),
    ...(camp.validMemberships === null ? [] : [{ label: 'Valid memberships', value: camp.validMemberships, note: 'valid today', tone: 'neutral' as const, icon: 'check' }]),
  ];
}
