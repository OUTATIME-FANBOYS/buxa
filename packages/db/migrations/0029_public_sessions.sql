-- Public session pages: a session (the parent row, formerly the class template) can be marked public. Its page is read without
-- signing in, by camp slug and session id, and lists the session's upcoming classes.
--
-- is_public: off by default, so no session is public until staff say so. The column sits on classes, so the existing row-level
-- security and grants cover it.
--
-- The public pages have no signed-in user, so they read through two SECURITY DEFINER functions (owner's rights, fixed
-- search_path, executable by buxa_app only). Each returns only what a visitor may see: the session's name, description and
-- dates, and its classes' names, age ranges, times and locations. Instructors, enrolments, capacity and counts are not returned,
-- and nothing about contact details. A session is returned only when it is public and its camp is not archived.

ALTER TABLE classes ADD COLUMN is_public boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION buxa_public_session(p_slug text, p_session_id uuid)
RETURNS TABLE (camp_name text, camp_timezone text, session_name text, session_description text, starts_on date, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.name, o.timezone, p.name, p.description, p.starts_on, p.ends_on
    FROM classes p JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public;
$$;

-- Classes that have not ended yet, soonest first. Only the class's own name, ages, times and place are returned.
CREATE OR REPLACE FUNCTION buxa_public_classes(p_slug text, p_session_id uuid, p_from timestamptz)
RETURNS TABLE (class_name text, age_min integer, age_max integer, location text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.name, s.age_min, s.age_max, s.location, s.starts_at, s.ends_at
    FROM sessions s
    JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
    JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

REVOKE ALL ON FUNCTION buxa_public_session(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_public_classes(text, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_public_session(text, uuid) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_public_classes(text, uuid, timestamptz) TO buxa_app;
