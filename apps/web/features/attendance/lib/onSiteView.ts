import type { PickupOption, OnSiteEntry } from '@/server/services';
import { displayName } from './name';
import { formatCampTime } from './time';

/** One row of the on-site list, already in words and camp-local time, ready for the client row. */
export interface OnSiteRowView {
  personId: string;
  name: string;
  arrivedAt: string;
  isMinor: boolean;
  pickupOptions: PickupOption[];
}

export function toOnSiteRow(row: OnSiteEntry, timeZone: string): OnSiteRowView {
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
