import type { PickupOption, OnSiteEntry } from '@/server/services';
import { displayName } from './name';
import { formatCampTime } from './time';

/**
 * An on-site entry as the screen reads it. `isMinor` may be null when the service cannot tell for this viewer: null is unknown, so the
 * screen neither marks the person as a child nor treats them as an adult. The server still decides every check-out.
 */
export type OnSiteEntryInput = Omit<OnSiteEntry, 'isMinor'> & { isMinor: boolean | null };

/** One row of the on-site list, already in words and camp-local time, ready for the client row. */
export interface OnSiteRowView {
  personId: string;
  name: string;
  arrivedAt: string;
  isMinor: boolean | null;
  pickupOptions: PickupOption[];
}

export function toOnSiteRow(row: OnSiteEntryInput, timeZone: string): OnSiteRowView {
  return {
    personId: row.person.id,
    name: displayName(row.person),
    arrivedAt: formatCampTime(row.entry.checkedInAt, timeZone),
    isMinor: row.isMinor,
    pickupOptions: row.pickupOptions,
  };
}

/** "3 people on site" and "1 person on site". */
export const onSiteSummary = (count: number): string => `${count} ${count === 1 ? 'person' : 'people'} on site now`;
