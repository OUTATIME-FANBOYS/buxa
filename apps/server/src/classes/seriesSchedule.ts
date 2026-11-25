import {
  classWithinSession,
  dayLabel,
  diffSeriesDays,
  findClash,
  formatClash,
  planSeries,
  seriesDaysInUseMessage,
  type Actor,
  type SeriesDetails,
} from '@buxa/domain';
import type { Class, NewSeriesInput, Series } from '@buxa/contracts';
import type { CampClassSpan, ClassRepository, SeriesFields, SeriesSchedule } from './ClassRepository';
import { ClassOutsideSessionError, RecurrenceRefusedError, SeriesDaysInUseError } from './errors';

/*
 * Helpers for an edit of a series (ClassService.updateSeries): what the form's fields are as the repository stores them, and the
 * change to the days that an edit of the weekdays or the Starts and Ends date-times makes.
 */

/** The fields every day of a series shares, from the form. */
export function fieldsOf(input: NewSeriesInput): SeriesFields {
  return {
    name: input.name,
    ageRange: input.ageRange,
    capacity: input.capacity,
    location: input.location,
    instructorIds: input.instructorIds,
    price: input.price,
  };
}

/** A saved series' locked fields, for a teacher's change to be compared against. */
export function detailsOfSeries(series: Series): SeriesDetails {
  return {
    ageRange: series.ageRange,
    capacity: series.capacity,
    location: series.location,
    instructorIds: series.instructorIds,
    price: series.price,
    weekdays: series.weekdays,
    startsLocal: series.startsLocal,
    endsLocal: series.endsLocal,
  };
}

/** The locked fields of a change, as the form sent them. */
export function detailsOfInput(input: NewSeriesInput): SeriesDetails {
  return {
    ageRange: input.ageRange,
    capacity: input.capacity,
    location: input.location,
    instructorIds: input.instructorIds,
    price: input.price,
    weekdays: input.weekdays,
    startsLocal: input.startsAt,
    endsLocal: input.endsAt,
  };
}

/**
 * The change to a series' days that an edit makes, or null when its weekdays and Starts and Ends are as saved (then only the shared
 * fields change). The new days are planned from the weekdays and the two date-times, checked against the session's dates and against
 * every other class in the camp, and the active days no planned day matches are removed. A removed day that a child, a hold or a
 * registration is on refuses the whole edit, naming them (SeriesDaysInUseError). Cancelled days are left as they are.
 */
export async function scheduleOfSeries(
  repo: ClassRepository,
  actor: Actor,
  existing: Series,
  stored: readonly Class[],
  input: NewSeriesInput,
  timeZone: string,
): Promise<SeriesSchedule | null> {
  const sameWeekdays = [...existing.weekdays].sort().join() === [...input.weekdays].sort().join();
  if (sameWeekdays && existing.startsLocal === input.startsAt && existing.endsLocal === input.endsAt) {
    return null;
  }
  const plan = planSeries({ weekdays: input.weekdays, startsLocal: input.startsAt, endsLocal: input.endsAt }, timeZone);
  if (!plan.ok) {
    throw new RecurrenceRefusedError('recurrence_invalid', plan.message);
  }
  const session = await repo.getSession(actor.userId, actor.orgId, existing.sessionId);
  const days =
    session && session.startsOn !== null && session.endsOn !== null
      ? { startsOn: session.startsOn, endsOn: session.endsOn }
      : null;
  for (const occurrence of plan.series.occurrences) {
    if (days && !classWithinSession(occurrence, days, timeZone)) {
      throw new ClassOutsideSessionError(days.startsOn, days.endsOn);
    }
  }

  const storedDays = stored.map(d => ({
    id: d.id,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    status: d.occurrenceStatus,
  }));
  const diff = diffSeriesDays(storedDays, plan.series.occurrences);
  if (diff.removed.length > 0) {
    const people = await repo.seriesHolders(actor.userId, actor.orgId, existing.id);
    if (people.length > 0) {
      const labels = diff.removed.map(d => dayLabel(d.startsAt, timeZone));
      throw new SeriesDaysInUseError(seriesDaysInUseMessage(existing.name, people, labels));
    }
  }

  // The new days are checked against every class in the camp except this series' own days, which are being replaced.
  const others = (await repo.listCampClassSpans(actor.userId, actor.orgId)).filter(
    span => span.seriesId !== existing.id,
  );
  const accepted: CampClassSpan[] = [];
  for (const occurrence of diff.add) {
    const clash = findClash(occurrence, [...others, ...accepted]);
    if (clash) {
      throw new RecurrenceRefusedError(
        'class_clash',
        `${input.name} on ${occurrence.date} clashes with ${clash.className} (${formatClash(clash, timeZone)}). Choose other times or days; nothing was saved.`,
      );
    }
    accepted.push({ startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, className: input.name, seriesId: null });
  }

  return {
    weekdays: plan.series.weekdays,
    seriesStartsAt: plan.series.seriesStartsAt,
    seriesEndsAt: plan.series.seriesEndsAt,
    add: diff.add.map(o => ({ startsAt: o.startsAt, endsAt: o.endsAt })),
    removeIds: diff.remove,
  };
}
