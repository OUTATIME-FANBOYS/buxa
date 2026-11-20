-- v0.3: a Session is a date range that holds Classes; a Class is a time range with its own name, ages, camp size and location.
-- The physical tables keep their names so the release running during a deploy still works:
--   classes  = the parent rows (formerly the class template). The app calls them Sessions.
--   sessions = the time-range rows (formerly the occurrences). The app calls them Classes.
--   enrolments.session_id and session_instructors.session_id point at sessions (a Class).
-- Expand only: nothing is dropped here. The ratio columns and classes.default_capacity stay (see docs/plans/sessions-classes.md).

-- 1. The parent gets a date range (camp-local days, inclusive). Old rows with no classes keep NULL: "dates not set".
ALTER TABLE classes
  ADD COLUMN starts_on date,
  ADD COLUMN ends_on date,
  ADD CONSTRAINT classes_dates_both CHECK ((starts_on IS NULL) = (ends_on IS NULL)),
  ADD CONSTRAINT classes_dates_order CHECK (ends_on IS NULL OR ends_on >= starts_on),
  -- A session has no camp size of its own now; the camp size belongs to each class.
  ALTER COLUMN default_capacity DROP NOT NULL;

-- 2. The time-range row gets its own name, ages (copied from the parent) and is then edited independently.
ALTER TABLE sessions
  ADD COLUMN name text CHECK (name IS NULL OR length(btrim(name)) BETWEEN 1 AND 120),
  ADD COLUMN age_min integer CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 120),
  ADD COLUMN age_max integer CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 120),
  ADD CONSTRAINT sessions_ages_order CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max);

-- 3. Backfill. Each org is set as the current tenant in turn, so row-level security lets the update see its rows.
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM orgs LOOP
    PERFORM set_config('app.org_id', o.id::text, true);

    UPDATE classes c
       SET starts_on = d.first_day, ends_on = d.last_day
      FROM (
        SELECT s.class_id AS id,
               min((s.starts_at AT TIME ZONE t.timezone)::date) AS first_day,
               max((s.ends_at AT TIME ZONE t.timezone)::date) AS last_day
          FROM sessions s JOIN orgs t ON t.id = s.org_id
         WHERE s.org_id = o.id
         GROUP BY s.class_id
      ) d
     WHERE c.id = d.id AND c.org_id = o.id;

    UPDATE sessions s
       SET name = c.name, age_min = c.age_min, age_max = c.age_max
      FROM classes c
     WHERE c.id = s.class_id AND c.org_id = s.org_id AND s.org_id = o.id;
  END LOOP;
  PERFORM set_config('app.org_id', '', true);
END $$;

-- 4. A class row written without a name or ages (the release that is still running, or the spreadsheet import) takes them from its session.
CREATE FUNCTION sessions_fill_from_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_name text;
  parent_min integer;
  parent_max integer;
BEGIN
  IF NEW.name IS NOT NULL AND NEW.age_min IS NOT NULL AND NEW.age_max IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.name, c.age_min, c.age_max INTO parent_name, parent_min, parent_max FROM classes c WHERE c.id = NEW.class_id;
  NEW.name := COALESCE(NEW.name, parent_name);
  NEW.age_min := COALESCE(NEW.age_min, parent_min);
  NEW.age_max := COALESCE(NEW.age_max, parent_max);
  RETURN NEW;
END $$;

CREATE TRIGGER sessions_fill_from_session BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION sessions_fill_from_session();

-- 5. The session's date range always covers its classes. It only widens: a range typed in by a person is never shrunk here.
CREATE FUNCTION sessions_widen_session_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tz text;
  first_day date;
  last_day date;
BEGIN
  SELECT o.timezone INTO tz FROM orgs o WHERE o.id = NEW.org_id;
  first_day := (NEW.starts_at AT TIME ZONE tz)::date;
  last_day := (NEW.ends_at AT TIME ZONE tz)::date;
  UPDATE classes c
     SET starts_on = LEAST(COALESCE(c.starts_on, first_day), first_day),
         ends_on = GREATEST(COALESCE(c.ends_on, last_day), last_day)
   WHERE c.id = NEW.class_id AND c.org_id = NEW.org_id;
  RETURN NEW;
END $$;

CREATE TRIGGER sessions_widen_session_dates AFTER INSERT OR UPDATE OF starts_at, ends_at, class_id ON sessions
  FOR EACH ROW EXECUTE FUNCTION sessions_widen_session_dates();

-- 6. Deleting a class. Request code has no DELETE grant, so the delete runs here, as the owner, like buxa_delete_camp (0013).
-- A class with any enrolment, cancelled ones included, is refused, so no enrolment history is lost. The app checks
-- classes:manage with authorize() before it calls this.
CREATE FUNCTION buxa_delete_class(p_org_id uuid, p_class_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrolments WHERE session_id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'The class has enrolments' USING ERRCODE = '23503', CONSTRAINT = 'sessions_has_enrolments';
  END IF;
  DELETE FROM sessions WHERE id = p_class_id AND org_id = p_org_id;
END $$;

-- 7. Replacing a class's instructors (edit). Same reason as 6: request code has no DELETE grant on session_instructors.
CREATE FUNCTION buxa_replace_class_instructors(p_org_id uuid, p_class_id uuid, p_person_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM people WHERE org_id = p_org_id AND id = ANY (p_person_ids)) <> cardinality(p_person_ids) THEN
    RAISE EXCEPTION 'Instructor not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM session_instructors WHERE session_id = p_class_id AND org_id = p_org_id;
  INSERT INTO session_instructors (org_id, session_id, person_id)
    SELECT p_org_id, p_class_id, unnest(p_person_ids);
END $$;

REVOKE ALL ON FUNCTION buxa_delete_class(uuid, uuid), buxa_replace_class_instructors(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_class(uuid, uuid), buxa_replace_class_instructors(uuid, uuid, uuid[]) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_delete_class(uuid, uuid), buxa_replace_class_instructors(uuid, uuid, uuid[]) FROM %I', r);
    END IF;
  END LOOP;
END $$;
