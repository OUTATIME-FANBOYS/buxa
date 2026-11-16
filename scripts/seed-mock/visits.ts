import type { Actor } from '@buxa/domain';
import type { Services } from '../../apps/web/server/runtime';
import type { RosterIds } from './people';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Sets the clock the services read. */
export type SetTime = (at: Date) => void;

/**
 * A handful of visits so the on-site list and the log are not empty: three children and two adults on site now, one child
 * collected by a guardian earlier today, and one closed visit from yesterday. Times are set relative to `base` (the run time,
 * a few hours back), so the on-site list has the same shape on every run. Returns the number of check-ins made.
 */
export async function seedVisits(services: Services, staff: Actor, ids: RosterIds, base: Date, setTime: SetTime): Promise<number> {
  const at = (offsetMs: number): Date => new Date(base.getTime() + offsetMs);
  // Roster order: family 0 has campers 0 and 1, family 1 has camper 2, family 2 has campers 3 and 4.
  const [camperA, camperB, camperC, camperD] = ids.campers;
  const [guardianA, guardianB, guardianC] = ids.primaryGuardians;

  setTime(at(-120 * MINUTE));
  await services.attendance.checkIn(staff, { personId: camperA, method: 'qr' });
  setTime(at(-100 * MINUTE));
  await services.attendance.checkIn(staff, { personId: camperB, method: 'qr' });
  setTime(at(-90 * MINUTE));
  await services.attendance.checkIn(staff, { personId: guardianA, method: 'manual', note: 'Arrived with the family' });
  setTime(at(-80 * MINUTE));
  await services.attendance.checkIn(staff, { personId: ids.adults.Ben, method: 'qr' });
  setTime(at(-70 * MINUTE));
  await services.attendance.checkIn(staff, { personId: camperC, method: 'qr' });
  setTime(at(-20 * MINUTE));
  await services.attendance.checkOut(staff, { personId: camperC, collectedByPersonId: guardianB });

  setTime(at(-26 * HOUR));
  await services.attendance.checkIn(staff, { personId: camperD, method: 'qr' });
  setTime(at(-25 * HOUR));
  await services.attendance.checkOut(staff, { personId: camperD, collectedByPersonId: guardianC });
  return 6;
}
