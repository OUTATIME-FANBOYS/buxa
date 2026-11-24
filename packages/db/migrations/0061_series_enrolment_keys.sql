-- drop-approved: v0.4 class series (the per-session unique indexes on enrolments and seat_holds are replaced by per-series ones; the old code relies only on one active row per child per place, which the new indexes keep)
-- v0.4 class series: a family enrols once in a SERIES, not once per occurrence. Capacity, holds, the waitlist and the price
-- apply per series. Attendance and the calendar stay per occurrence (sessions rows).
--
-- THE KEY (decision, documented in docs/phases/03-registration.md and 04-seats-rosters.md):
--   enrolments, seat_holds and registration_classes get series_id. series_id is the key for everything that counts a
--   child's place: one active enrolment or hold per child per series (unique index), the capacity count and the lock.
--   session_id is KEPT on those three tables as the ANCHOR: the occurrence a row was made against, so the existing readers
--   and the cascade from the session still work. The anchor is checked by a composite foreign key
--   (org_id, session_id, series_id) -> sessions, so an anchor can only belong to its own series. An anchor is not a
--   "current" occurrence: a cancelled occurrence does not change the series, so the place stays.
--
-- Capacity moves to the series: class_series.capacity is the camp size. The capacity triggers now lock the series row
-- (class_series), count the series' enrolments and live holds, and refuse a capacity below the places taken. The
-- sessions.capacity column stays for the release still running; the app reads the series.
--
-- Overlap: a child may not hold an active enrolment in two series whose ACTIVE occurrences overlap in time (half-open
-- ranges, so a class that ends at 12:00 does not clash with one that starts at 12:00). The database refuses a new or
-- changed enrolment that breaks this. An existing overlap (written before this migration) stops the migration and is listed.
--
-- Stop, changing nothing, when the grouped data would break a key:
--   - one child has two active enrolments in one series (the 0060 grouping moves them onto the same key);
--   - one child has two active holds in one series;
--   - an existing enrolment overlaps another series' active occurrence for the same child.
-- Each stop lists the rows. The file rolls back as a whole.

-- 1. Add the keys, then fill them from the occurrence each row points at (the series that occurrence belongs to).
ALTER TABLE enrolments ADD COLUMN series_id uuid;
ALTER TABLE seat_holds ADD COLUMN series_id uuid;
ALTER TABLE registration_classes ADD COLUMN series_id uuid;

UPDATE enrolments e SET series_id = s.series_id FROM sessions s WHERE s.id = e.session_id AND s.org_id = e.org_id;
UPDATE seat_holds h SET series_id = s.series_id FROM sessions s WHERE s.id = h.session_id AND s.org_id = h.org_id;
UPDATE registration_classes r SET series_id = s.series_id FROM sessions s WHERE s.id = r.class_id AND s.org_id = r.org_id;

-- 2. Stop when the grouped rows would break a key. Nothing is changed when this raises.
DO $$
DECLARE
  problems text;
BEGIN
  SELECT string_agg(format('  series %s, child %s: enrolments %s', d.series_id, d.person_id, d.ids), E'\n' ORDER BY d.series_id, d.person_id)
    INTO problems
    FROM (
      SELECT e.series_id, e.person_id, string_agg(e.id::text, ', ' ORDER BY e.id) AS ids
        FROM enrolments e
       WHERE e.status IN ('enrolled', 'waitlisted')
       GROUP BY e.series_id, e.person_id
      HAVING count(*) > 1
    ) d;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Class series migration 0061 stopped: a child has two active enrolments in one series, so the enrolments cannot move onto the series. Nothing was changed. Resolve these by hand, then run again:\n%', problems;
  END IF;

  SELECT string_agg(format('  series %s, child %s: holds %s', d.series_id, d.person_id, d.ids), E'\n' ORDER BY d.series_id, d.person_id)
    INTO problems
    FROM (
      SELECT h.series_id, h.person_id, string_agg(h.id::text, ', ' ORDER BY h.id) AS ids
        FROM seat_holds h
       WHERE h.released_at IS NULL AND h.person_id IS NOT NULL
       GROUP BY h.series_id, h.person_id
      HAVING count(*) > 1
    ) d;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Class series migration 0061 stopped: a child has two active seat holds in one series. Nothing was changed. Release the extra holds by hand, then run again:\n%', problems;
  END IF;

  SELECT string_agg(format('  child %s: enrolment %s in series %s and enrolment %s in series %s', a.person_id, a.id, a.series_id, b.id, b.series_id), E'\n')
    INTO problems
    FROM enrolments a
    JOIN enrolments b ON b.org_id = a.org_id AND b.person_id = a.person_id AND b.id > a.id AND b.series_id <> a.series_id
   WHERE a.status IN ('enrolled', 'waitlisted')
     AND b.status IN ('enrolled', 'waitlisted')
     AND EXISTS (
       SELECT 1
         FROM sessions x
         JOIN sessions y ON y.org_id = x.org_id AND y.series_id = b.series_id
        WHERE x.series_id = a.series_id AND x.org_id = a.org_id
          AND x.status = 'active' AND y.status = 'active'
          AND tstzrange(x.starts_at, x.ends_at) && tstzrange(y.starts_at, y.ends_at)
     );
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Class series migration 0061 stopped: a child has enrolments in two series whose occurrences overlap in time. Nothing was changed. Move or cancel one of them by hand, then run again:\n%', problems;
  END IF;
END $$;

ALTER TABLE enrolments ALTER COLUMN series_id SET NOT NULL;
ALTER TABLE seat_holds ALTER COLUMN series_id SET NOT NULL;
ALTER TABLE registration_classes ALTER COLUMN series_id SET NOT NULL;

ALTER TABLE enrolments
  ADD CONSTRAINT enrolments_series_anchor_fk FOREIGN KEY (org_id, session_id, series_id)
    REFERENCES sessions (org_id, id, series_id) ON DELETE CASCADE;
ALTER TABLE seat_holds
  ADD CONSTRAINT seat_holds_series_anchor_fk FOREIGN KEY (org_id, session_id, series_id)
    REFERENCES sessions (org_id, id, series_id) ON DELETE CASCADE;
ALTER TABLE registration_classes
  ADD CONSTRAINT registration_classes_series_anchor_fk FOREIGN KEY (org_id, class_id, series_id)
    REFERENCES sessions (org_id, id, series_id) ON DELETE CASCADE;

-- 3. The keys. One active enrolment or hold per child per series replaces the per-session ones.
DROP INDEX enrolments_one_active_idx;
CREATE UNIQUE INDEX enrolments_one_active_series_idx ON enrolments (series_id, person_id)
  WHERE status IN ('enrolled', 'waitlisted');
CREATE INDEX enrolments_org_series_idx ON enrolments (org_id, series_id, status);

DROP INDEX seat_holds_one_active_person_idx;
CREATE UNIQUE INDEX seat_holds_one_active_series_person_idx ON seat_holds (series_id, person_id)
  WHERE released_at IS NULL;
CREATE INDEX seat_holds_org_series_idx ON seat_holds (org_id, series_id) WHERE released_at IS NULL;

CREATE INDEX registration_classes_org_series_idx ON registration_classes (org_id, series_id);

-- 4. The seats a series has taken right now: enrolled children plus live holds (unreleased and not yet expired).
CREATE FUNCTION series_seats_taken(p_series_id uuid) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT count(*) FROM enrolments e WHERE e.series_id = p_series_id AND e.status = 'enrolled')
        + (SELECT count(*) FROM seat_holds h
            WHERE h.series_id = p_series_id AND h.released_at IS NULL AND h.expires_at > now()))::integer
$$;

-- The old per-occurrence name stays for the release still running and for sessions_enforce_capacity. It now counts the series.
CREATE OR REPLACE FUNCTION session_seats_taken(p_session_id uuid) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT series_seats_taken(s.series_id) FROM sessions s WHERE s.id = p_session_id
$$;

-- 5. Capacity checks lock the series row (class_series), the same lock for enrolments and holds.
CREATE OR REPLACE FUNCTION enrolments_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  IF NEW.status <> 'enrolled' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'enrolled' AND OLD.series_id = NEW.series_id THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM class_series WHERE id = NEW.series_id FOR UPDATE;
  -- BEFORE trigger: the incoming row is not counted yet, so it is added here.
  taken := series_seats_taken(NEW.series_id);
  IF taken + 1 > cap THEN
    RAISE EXCEPTION 'session is full' USING ERRCODE = 'check_violation', CONSTRAINT = 'enrolments_capacity';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER enrolments_capacity ON enrolments;
CREATE TRIGGER enrolments_capacity BEFORE INSERT OR UPDATE OF status, series_id ON enrolments
  FOR EACH ROW EXECUTE FUNCTION enrolments_enforce_capacity();

CREATE OR REPLACE FUNCTION seat_holds_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  SELECT capacity INTO cap FROM class_series WHERE id = NEW.series_id FOR UPDATE;
  taken := series_seats_taken(NEW.series_id);
  IF taken + 1 > cap THEN
    RAISE EXCEPTION 'session is full' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_capacity';
  END IF;
  RETURN NEW;
END $$;

-- Lowering a series' camp size below the places taken (enrolled or held) is refused. The occurrence row's own capacity
-- (sessions_enforce_capacity, 0025) now counts the series as well.
CREATE FUNCTION class_series_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  taken integer;
BEGIN
  IF NEW.capacity >= OLD.capacity THEN RETURN NEW; END IF;
  taken := series_seats_taken(NEW.id);
  IF taken > NEW.capacity THEN
    RAISE EXCEPTION 'capacity % is below the % places already taken', NEW.capacity, taken
      USING ERRCODE = 'check_violation', CONSTRAINT = 'class_series_capacity_floor';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER class_series_capacity_floor BEFORE UPDATE OF capacity ON class_series
  FOR EACH ROW EXECUTE FUNCTION class_series_enforce_capacity();

-- 6. Overlap across series. Active occurrences only; a cancelled day clashes with nothing.
CREATE FUNCTION enrolments_refuse_series_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('enrolled', 'waitlisted') THEN RETURN NEW; END IF;
  -- An admin may override an overlap with a recorded reason (enrolments.overridden, checked by the app); the reason is the audit.
  IF NEW.overridden THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('enrolled', 'waitlisted')
     AND OLD.series_id = NEW.series_id AND OLD.person_id = NEW.person_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM enrolments other
      JOIN sessions mine ON mine.org_id = NEW.org_id AND mine.series_id = NEW.series_id AND mine.status = 'active'
      JOIN sessions theirs ON theirs.org_id = other.org_id AND theirs.series_id = other.series_id AND theirs.status = 'active'
     WHERE other.org_id = NEW.org_id
       AND other.person_id = NEW.person_id
       AND other.id <> NEW.id
       AND other.series_id <> NEW.series_id
       AND other.status IN ('enrolled', 'waitlisted')
       AND tstzrange(mine.starts_at, mine.ends_at) && tstzrange(theirs.starts_at, theirs.ends_at)
  ) THEN
    RAISE EXCEPTION 'this child is already enrolled in a class that overlaps this one'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'enrolments_series_overlap';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enrolments_series_overlap BEFORE INSERT OR UPDATE OF status, series_id, person_id ON enrolments
  FOR EACH ROW EXECUTE FUNCTION enrolments_refuse_series_overlap();

-- 7. A hold keeps its series. (The backfill above ran before this guard existed, so it could set the column.)
CREATE OR REPLACE FUNCTION seat_holds_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.released_at IS NOT NULL
     AND (NEW.released_at IS DISTINCT FROM OLD.released_at OR NEW.release_reason IS DISTINCT FROM OLD.release_reason) THEN
    RAISE EXCEPTION 'a released hold cannot be changed' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_released_final';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.series_id IS DISTINCT FROM OLD.series_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'a hold keeps its class, household, child and expiry' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_place_fixed';
  END IF;

  RETURN NEW;
END $$;

-- 8. A row written with only its occurrence (the release still running, or a write path not yet moved to the series) takes
-- the series of that occurrence. The name starts with a digit so it fires before the capacity and overlap checks, which
-- read series_id (triggers fire in name order). A row that names a series keeps it.
CREATE FUNCTION fill_series_from_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.series_id IS NULL THEN
    SELECT s.series_id INTO NEW.series_id FROM sessions s WHERE s.org_id = NEW.org_id AND s.id = NEW.session_id;
    -- No such occurrence in this camp: a value that matches no series, so the composite key refuses the row (23503).
    IF NEW.series_id IS NULL THEN NEW.series_id := gen_random_uuid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION fill_class_series_from_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.series_id IS NULL THEN
    SELECT s.series_id INTO NEW.series_id FROM sessions s WHERE s.org_id = NEW.org_id AND s.id = NEW.class_id;
    -- No such occurrence in this camp: a value that matches no series, so the composite key refuses the row (23503).
    IF NEW.series_id IS NULL THEN NEW.series_id := gen_random_uuid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enrolments_0_fill_series BEFORE INSERT ON enrolments
  FOR EACH ROW EXECUTE FUNCTION fill_series_from_session();
CREATE TRIGGER seat_holds_0_fill_series BEFORE INSERT ON seat_holds
  FOR EACH ROW EXECUTE FUNCTION fill_series_from_session();
CREATE TRIGGER registration_classes_0_fill_series BEFORE INSERT ON registration_classes
  FOR EACH ROW EXECUTE FUNCTION fill_class_series_from_session();
