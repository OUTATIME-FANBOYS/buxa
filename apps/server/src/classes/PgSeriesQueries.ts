import { isUuid } from '@buxa/domain';
import type { Class, Series } from '@buxa/contracts';
import { type Db } from '../people/pgRows';
import {
  CLASS_COLUMNS,
  CLASS_FROM,
  toAgeRange,
  toClass,
  toPrice,
  type ClassRow,
  type PriceRow,
} from './PgClassQueries';

/**
 * One row per series. The clock times are read from its first day in camp time, the days from its first and last day, and the
 * counts from its days. The instructors are the first day's (a series' days share one instructor set, see updateSeries). Seats and
 * the waitlist are counted per series (migration 0061), so they are read in the same statement as the rest.
 */
interface SeriesRow extends PriceRow {
  series_id: string;
  session_id: string;
  session_name: string;
  name: string;
  age_min: number | null;
  age_max: number | null;
  capacity: number;
  location: string;
  weekdays: number[];
  first_day: string;
  last_day: string;
  start_time: string;
  end_time: string;
  occurrence_count: number;
  active_count: number;
  anchor_id: string;
  seats_taken: number;
  waitlisted: number;
  instructors: { id: string; name: string }[];
}

const SERIES_SELECT = `
  SELECT cs.id AS series_id, p.id AS session_id, p.name AS session_name, cs.name, cs.age_min, cs.age_max,
         cs.capacity, cs.location, cs.weekdays,
         cs.price_minor, cs.price_currency, cs.early_bird_minor,
         to_char(cs.early_bird_until, 'YYYY-MM-DD') AS early_bird_until,
         to_char(first_day.starts_at AT TIME ZONE o.timezone, 'YYYY-MM-DD') AS first_day,
         to_char(last_day.starts_at AT TIME ZONE o.timezone, 'YYYY-MM-DD') AS last_day,
         to_char(first_day.starts_at AT TIME ZONE o.timezone, 'HH24:MI') AS start_time,
         to_char(first_day.ends_at AT TIME ZONE o.timezone, 'HH24:MI') AS end_time,
         counts.occurrence_count, counts.active_count,
         anchor.id AS anchor_id,
         series_seats_taken(cs.id) AS seats_taken,
         (SELECT count(*)::int FROM enrolments e WHERE e.series_id = cs.id AND e.status = 'waitlisted') AS waitlisted,
         COALESCE((SELECT json_agg(json_build_object('id', i.id::text, 'name', trim(i.given_name || ' ' || i.family_name))
                                    ORDER BY i.family_name, i.given_name, i.id)
                     FROM session_instructors si JOIN people i ON i.id = si.person_id
                    WHERE si.session_id = first_day.id), '[]'::json) AS instructors
    FROM class_series cs
    JOIN classes p ON p.id = cs.class_id AND p.org_id = cs.org_id
    JOIN orgs o ON o.id = cs.org_id
    JOIN LATERAL (SELECT s.id, s.starts_at, s.ends_at FROM sessions s
                   WHERE s.series_id = cs.id ORDER BY s.starts_at, s.id LIMIT 1) first_day ON true
    JOIN LATERAL (SELECT s.starts_at FROM sessions s
                   WHERE s.series_id = cs.id ORDER BY s.starts_at DESC, s.id DESC LIMIT 1) last_day ON true
    JOIN LATERAL (SELECT count(*)::int AS occurrence_count,
                         count(*) FILTER (WHERE s.status = 'active')::int AS active_count
                    FROM sessions s WHERE s.series_id = cs.id) counts ON true
    JOIN LATERAL (SELECT s.id FROM sessions s WHERE s.series_id = cs.id
                   ORDER BY (s.status = 'active') DESC, s.starts_at, s.id LIMIT 1) anchor ON true`;

function toSeries(row: SeriesRow): Series {
  return {
    id: row.series_id,
    sessionId: row.session_id,
    sessionName: row.session_name,
    name: row.name,
    ageRange: toAgeRange(row.age_min, row.age_max),
    capacity: row.capacity,
    location: row.location,
    weekdays: row.weekdays,
    startTime: row.start_time,
    endTime: row.end_time,
    firstDay: row.first_day,
    lastDay: row.last_day,
    occurrenceCount: row.occurrence_count,
    activeOccurrenceCount: row.active_count,
    anchorClassId: row.anchor_id,
    instructorIds: row.instructors.map(i => i.id),
    instructors: row.instructors.map(i => ({ id: i.id, name: i.name })),
    price: toPrice(row),
    seatsTaken: row.seats_taken,
    waitlisted: row.waitlisted,
  };
}

export async function listSeriesRows(db: Db, sessionId: string): Promise<Series[]> {
  const { rows } = await db.query<SeriesRow>(
    `${SERIES_SELECT} WHERE cs.class_id = $1 ORDER BY first_day.starts_at, cs.id`,
    [sessionId],
  );

  return rows.map(toSeries);
}

export async function getSeriesRow(db: Db, seriesId: string): Promise<Series | null> {
  if (!isUuid(seriesId)) {
    return null;
  }
  const { rows } = await db.query<SeriesRow>(`${SERIES_SELECT} WHERE cs.id = $1`, [seriesId]);

  return rows[0] ? toSeries(rows[0]) : null;
}

/** Every day of a series, in order, active and cancelled alike (the series page's list). */
export async function listSeriesDayRows(db: Db, seriesId: string): Promise<Class[]> {
  const { rows } = await db.query<ClassRow>(
    `SELECT ${CLASS_COLUMNS} ${CLASS_FROM} WHERE s.series_id = $1 ORDER BY s.starts_at, s.id`,
    [seriesId],
  );

  return rows.map(toClass);
}
