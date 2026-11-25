-- v0.4 class series: a cancelled day is not a class any more. Each function below reads the occurrences (rows of `sessions`) and
-- now skips the cancelled ones (sessions.status = 'cancelled', migration 0060):
--   - buxa_public_classes_v2: the public list of a session's classes (migration 0059 version, same signature and grants).
--   - buxa_teacher_calendar_feed_classes: the teacher's calendar feed (migration 0051 version, same signature and grants).
--   - buxa_calendar_feed_classes: the camp calendar feed (migration 0032 version, same signature and grants).
--
-- Also adds buxa_delete_series_v1: deletes a whole series (its days, then the series row) for a staff member or above
-- (classes:manage). Request code has no DELETE grant on class_series, so the delete runs here as the owner, like
-- buxa_delete_class_v2 (0032). A series with any enrolment, seat hold or registration is refused with the existing
-- "The class has enrolments" message, and nothing is deleted.

CREATE OR REPLACE FUNCTION buxa_public_classes_v2(p_slug text, p_session_id uuid, p_from timestamptz)
RETURNS TABLE (
  class_name text, age_min integer, age_max integer, location text, starts_at timestamptz, ends_at timestamptz,
  price_minor integer, price_currency text, early_bird_minor integer, early_bird_until text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.name, s.age_min, s.age_max, s.location, s.starts_at, s.ends_at,
         s.price_minor, s.price_currency::text, s.early_bird_minor, to_char(s.early_bird_until, 'YYYY-MM-DD')
    FROM sessions s
    JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
    JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public
     AND p.status = 'live' AND p.archived_at IS NULL
     AND NOT s.dates_outside_session
     AND s.status = 'active'
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

CREATE OR REPLACE FUNCTION buxa_teacher_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'teacher'
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN people p ON p.org_id = t.org_id AND p.user_id = t.user_id
    JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
    JOIN sessions s ON s.org_id = si.org_id AND s.id = si.session_id
   WHERE t.token_hash = p_hash
     AND s.status = 'active'
   ORDER BY s.starts_at, s.id;
$$;

-- The camp calendar feed (migration 0032): the same rule, a cancelled day is not on it.
CREATE OR REPLACE FUNCTION buxa_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM camp_calendar_tokens t
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN sessions s ON s.org_id = t.org_id
   WHERE t.token_hash = p_hash
     AND s.status = 'active'
   ORDER BY s.starts_at, s.id;
$$;

CREATE FUNCTION buxa_delete_series_v1(p_org_id uuid, p_series_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM class_series WHERE id = p_series_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrolments WHERE series_id = p_series_id AND org_id = p_org_id)
     OR EXISTS (SELECT 1 FROM seat_holds WHERE series_id = p_series_id AND org_id = p_org_id)
     OR EXISTS (SELECT 1 FROM registration_classes WHERE series_id = p_series_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'The class has enrolments' USING ERRCODE = '23503', CONSTRAINT = 'sessions_has_enrolments';
  END IF;
  DELETE FROM sessions WHERE series_id = p_series_id AND org_id = p_org_id;
  DELETE FROM class_series WHERE id = p_series_id AND org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_series_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_series_v1(uuid, uuid) TO buxa_app;
