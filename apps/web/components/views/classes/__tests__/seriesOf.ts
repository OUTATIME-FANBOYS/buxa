import type { Class, Series } from '@buxa/contracts';

/**
 * One series for each class in a fixture: a class is taken as the only day of its own series, with that series' id and its
 * anchor the class itself. Used by the page tests, which give the session page its series rather than its days.
 */
export function seriesOf(classes: readonly Class[]): Series[] {
  return classes.map(c => ({
    id: c.seriesId,
    sessionId: c.sessionId,
    sessionName: c.sessionName,
    name: c.name,
    ageRange: c.ageRange,
    capacity: c.capacity,
    location: c.location,
    weekdays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '12:00',
    firstDay: c.startsAt.slice(0, 10),
    lastDay: c.startsAt.slice(0, 10),
    startsLocal: `${c.startsAt.slice(0, 10)}T09:00`,
    endsLocal: `${c.startsAt.slice(0, 10)}T12:00`,
    occurrenceCount: 1,
    activeOccurrenceCount: c.occurrenceStatus === 'active' ? 1 : 0,
    anchorClassId: c.id,
    instructorIds: c.instructorIds,
    instructors: c.instructors,
    price: c.price,
    seatsTaken: c.seatsTaken,
    waitlisted: c.waitlisted,
  }));
}
