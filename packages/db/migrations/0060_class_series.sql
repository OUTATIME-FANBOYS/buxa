-- v0.4: a class becomes a series. A series is the thing a family enrols in once: it holds the name, ages, camp size
-- (capacity), location, price, weekdays and the first and last allowed times. The existing per-day rows of `sessions`
-- become its OCCURRENCES. Each occurrence keeps its own date and time of day, and its own status (active or cancelled).
--
-- Terms (see docs/phases/04-seats-rosters.md): a session is a row of `classes`; a class is a series (table `class_series`);
-- an occurrence is a row of `sessions`, the one-day row the app used to call a class.
--
-- GROUPING RULE (the backfill below). Occurrences are grouped into one series when all of these are equal:
--   same session (classes.id), name, ages (min and max), capacity, location, price and currency, early-bird amount and
--   last day, instructor set, and time of day (start and end, in the camp's time zone).
-- A series' weekdays are the distinct weekdays (1 Monday to 7 Sunday, camp time) of its occurrences. Its first and last
-- allowed times are the earliest starts_at and the latest ends_at of its occurrences.
-- A group STOPS the migration when two of its occurrences fall on the same calendar day (camp time). Then nothing is changed:
-- the migration raises an error that lists every such occurrence, and the whole file rolls back. Fix those rows by hand, then
-- run the migration again. "Distinct weekdays" in the owner's rule is read as "no two occurrences on one date": the same
-- weekday repeats across weeks (a Monday in each week is normal).
--
-- Expand only for the rows: nothing is dropped and no price, capacity or name column is removed from `sessions`. The app
-- reads the series for those values from now on; the old columns stay in step with the first occurrence until the contract
-- migration. Same rules as every camp table: org_id, forced row-level security, composite foreign keys, no DELETE for the
-- request role (a series goes with its session, through the owner's functions).

CREATE TABLE class_series (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  class_id          uuid NOT NULL,
  name              text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  age_min           integer CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 120),
  age_max           integer CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 120),
  CONSTRAINT class_series_ages_order CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
  capacity          integer NOT NULL CHECK (capacity > 0),
  location          text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 120),
  -- ISO weekdays, 1 = Monday to 7 = Sunday, camp time. At least one day.
  weekdays          smallint[] NOT NULL CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  -- The first and last allowed times of the series (the range its occurrences were generated from).
  series_starts_at  timestamptz NOT NULL,
  series_ends_at    timestamptz NOT NULL,
  CONSTRAINT class_series_times CHECK (series_ends_at > series_starts_at),
  -- Price: the same shape as the per-class price in migration 0050.
  price_minor       integer CHECK (price_minor IS NULL OR price_minor BETWEEN 0 AND 99999999999),
  price_currency    char(3) CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  early_bird_minor  integer CHECK (early_bird_minor IS NULL OR early_bird_minor BETWEEN 0 AND 99999999999),
  early_bird_until  date,
  CONSTRAINT class_series_price_shape CHECK (
    (price_minor IS NULL AND price_currency IS NULL AND early_bird_minor IS NULL AND early_bird_until IS NULL)
    OR (
      price_minor IS NOT NULL AND price_currency IS NOT NULL
      AND ((early_bird_minor IS NULL) = (early_bird_until IS NULL))
      AND (early_bird_minor IS NULL OR early_bird_minor <= price_minor)
    )
  ),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  -- A series belongs to one session. Occurrences reference the series together with its session (below).
  UNIQUE (org_id, id, class_id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE
);

ALTER TABLE class_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_series FORCE ROW LEVEL SECURITY;
CREATE POLICY class_series_tenant ON class_series FOR ALL TO buxa_app
  USING (org_id = current_org() AND is_member(org_id) IS NOT NULL)
  WITH CHECK (org_id = current_org() AND is_member(org_id) IS NOT NULL);
GRANT SELECT, INSERT, UPDATE ON class_series TO buxa_app;

-- Occurrence status and the series link. The status is the only thing that cancels one day: a cancelled occurrence keeps
-- its row, its time and its reason, and a restore clears the cancellation. The series does not change.
ALTER TABLE sessions
  ADD COLUMN series_id uuid,
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancel_reason text CHECK (cancel_reason IS NULL OR length(btrim(cancel_reason)) BETWEEN 1 AND 500),
  ADD CONSTRAINT sessions_status_shape CHECK (
    (status = 'active' AND cancelled_at IS NULL AND cancel_reason IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL)
  );

-- 1. Read the occurrences once, with their camp-time day, time of day, weekday and instructor set.
CREATE TEMP TABLE migration_occurrences ON COMMIT DROP AS
SELECT s.id AS session_id,
       s.org_id,
       s.class_id,
       COALESCE(s.name, p.name) AS name,
       s.age_min,
       s.age_max,
       s.capacity,
       s.location,
       s.price_minor,
       s.price_currency,
       s.early_bird_minor,
       s.early_bird_until,
       s.starts_at,
       s.ends_at,
       (s.starts_at AT TIME ZONE o.timezone)::date AS local_day,
       (s.starts_at AT TIME ZONE o.timezone)::time AS starts_time,
       (s.ends_at AT TIME ZONE o.timezone)::time AS ends_time,
       extract(isodow FROM s.starts_at AT TIME ZONE o.timezone)::smallint AS weekday,
       COALESCE(
         (SELECT array_agg(si.person_id ORDER BY si.person_id) FROM session_instructors si WHERE si.session_id = s.id),
         '{}'::uuid[]
       ) AS instructors
  FROM sessions s
  JOIN orgs o ON o.id = s.org_id
  JOIN classes p ON p.id = s.class_id;

-- 2. Number the groups. dense_rank treats equal values, and NULLs, as the same group.
CREATE TEMP TABLE migration_groups ON COMMIT DROP AS
SELECT m.*,
       dense_rank() OVER (
         ORDER BY m.class_id, m.name, m.age_min, m.age_max, m.capacity, m.location,
                  m.price_minor, m.price_currency, m.early_bird_minor, m.early_bird_until,
                  m.instructors, m.starts_time, m.ends_time
       ) AS grp
  FROM migration_occurrences m;

-- 3. Stop, changing nothing, when a group has two occurrences on one day.
DO $$
DECLARE
  problems text;
BEGIN
  SELECT string_agg(
           format('  session %s "%s" on %s starts %s (group %s)', g.session_id, g.name, g.local_day, g.starts_at, g.grp),
           E'\n' ORDER BY g.grp, g.starts_at
         )
    INTO problems
    FROM migration_groups g
   WHERE g.grp IN (
     SELECT grp FROM migration_groups GROUP BY grp, local_day HAVING count(*) > 1
   );
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Class series migration stopped: two occurrences of one class fall on the same day, so they cannot form a clean series. Nothing was changed. Fix these occurrences by hand, then run the migration again:\n%', problems;
  END IF;
END $$;

-- 4. One series per group.
CREATE TEMP TABLE migration_series ON COMMIT DROP AS
SELECT gen_random_uuid() AS series_id,
       g.grp,
       g.org_id,
       g.class_id,
       min(g.name) AS name,
       min(g.age_min) AS age_min,
       min(g.age_max) AS age_max,
       min(g.capacity) AS capacity,
       min(g.location) AS location,
       array_agg(DISTINCT g.weekday ORDER BY g.weekday) AS weekdays,
       min(g.starts_at) AS series_starts_at,
       max(g.ends_at) AS series_ends_at,
       min(g.price_minor) AS price_minor,
       min(g.price_currency) AS price_currency,
       min(g.early_bird_minor) AS early_bird_minor,
       min(g.early_bird_until) AS early_bird_until
  FROM migration_groups g
 GROUP BY g.grp, g.org_id, g.class_id;

INSERT INTO class_series (
  id, org_id, class_id, name, age_min, age_max, capacity, location, weekdays,
  series_starts_at, series_ends_at, price_minor, price_currency, early_bird_minor, early_bird_until
)
SELECT series_id, org_id, class_id, name, age_min, age_max, capacity, location, weekdays,
       series_starts_at, series_ends_at, price_minor, price_currency, early_bird_minor, early_bird_until
  FROM migration_series;

-- 5. Each occurrence joins its group's series.
UPDATE sessions s
   SET series_id = ms.series_id
  FROM migration_groups g
  JOIN migration_series ms ON ms.grp = g.grp
 WHERE s.id = g.session_id;

ALTER TABLE sessions ALTER COLUMN series_id SET NOT NULL;
-- The occurrence's series must belong to the same session (the class_id it is written with), in the same camp.
ALTER TABLE sessions
  ADD CONSTRAINT sessions_series_fk FOREIGN KEY (org_id, series_id, class_id)
    REFERENCES class_series (org_id, id, class_id) ON DELETE CASCADE,
  -- Target for the enrolment, hold and place links in the next migration: the occurrence's series, checked by key.
  ADD CONSTRAINT sessions_org_id_series_id_key UNIQUE (org_id, id, series_id);

CREATE INDEX sessions_org_series_idx ON sessions (org_id, series_id, starts_at);

-- 6. An occurrence written without a series (a release still running the old code) gets its own one-occurrence series, built
-- from the row, so the old insert keeps working. The new code always sets series_id itself.
CREATE FUNCTION sessions_make_series_for_legacy_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tz text;
  new_series_id uuid;
BEGIN
  IF NEW.series_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT o.timezone INTO tz FROM orgs o WHERE o.id = NEW.org_id;
  INSERT INTO class_series (
    org_id, class_id, name, age_min, age_max, capacity, location, weekdays,
    series_starts_at, series_ends_at, price_minor, price_currency, early_bird_minor, early_bird_until
  )
  VALUES (
    NEW.org_id, NEW.class_id,
    COALESCE(NEW.name, (SELECT p.name FROM classes p WHERE p.id = NEW.class_id), 'Untitled session'),
    NEW.age_min, NEW.age_max, NEW.capacity, NEW.location,
    ARRAY[extract(isodow FROM NEW.starts_at AT TIME ZONE tz)::smallint],
    NEW.starts_at, NEW.ends_at, NEW.price_minor, NEW.price_currency, NEW.early_bird_minor, NEW.early_bird_until
  )
  RETURNING id INTO new_series_id;
  NEW.series_id := new_series_id;
  RETURN NEW;
END $$;

-- Named to run after sessions_fill_from_session (0022), which fills the name and ages first.
CREATE TRIGGER sessions_make_series_for_legacy_insert BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION sessions_make_series_for_legacy_insert();
