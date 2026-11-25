-- Session status (owner decision, docs/phases/03-registration.md "Session lifecycle"). A session is a row of `classes`; a class is a
-- row of `sessions`. A session is a draft, live or archived:
--   draft     new sessions start here. Registration and enrolment are refused. A draft can be deleted with everything under it.
--   live      registration and enrolment are accepted, and the public page shows it (when it is public).
--   archived  closed and kept. Hidden from registration and from the public page.
--
-- Written to run safely on a database that already holds data (production's migration state is not confirmed):
-- 1. The column is added NOT NULL with the default 'live', so every existing session becomes live without a table rewrite, and a
--    release that does not know the column yet keeps inserting live sessions, as it did before. The app writes 'draft' itself for a
--    new session (insertSession). archived_at stays: it is the time the session was archived.
-- 2. Existing archived sessions (archived_at set by migration 0052) become 'archived'. Each camp is set as the tenant in turn, so
--    row-level security lets the update see its rows (the same approach as 0022).
-- 3. The public-page functions show a session only when it is live and archived_at is empty, so a release that still sets only
--    archived_at is also respected. Same signatures and returns as 0052; CREATE OR REPLACE keeps the grants.
-- 4. buxa_delete_draft_session_v1 deletes a draft session with everything under it (its classes, groups, rooms, assignments,
--    instructor links and form links) for an admin or the owner. It refuses a session that is not a draft, and a draft that holds an
--    enrolment, seat hold, registration, check-in or season pass (none can exist for a draft; the check is a guard).
--
-- Expand only: nothing is dropped. The cascade from classes to sessions is still guarded by migration 0035.

ALTER TABLE classes ADD COLUMN status text NOT NULL DEFAULT 'live';
ALTER TABLE classes ADD CONSTRAINT classes_status_check CHECK (status IN ('draft', 'live', 'archived'));

DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM orgs LOOP
    PERFORM set_config('app.org_id', o.id::text, true);
    UPDATE classes SET status = 'archived' WHERE org_id = o.id AND archived_at IS NOT NULL;
  END LOOP;
  PERFORM set_config('app.org_id', '', true);
END $$;

CREATE INDEX classes_org_status_idx ON classes (org_id, status);

CREATE OR REPLACE FUNCTION buxa_public_session(p_slug text, p_session_id uuid)
RETURNS TABLE (camp_name text, camp_timezone text, session_name text, session_description text, starts_on date, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.name, o.timezone, p.name, p.description, p.starts_on, p.ends_on
    FROM classes p JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public
     AND p.status = 'live' AND p.archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION buxa_public_classes(p_slug text, p_session_id uuid, p_from timestamptz)
RETURNS TABLE (class_name text, age_min integer, age_max integer, location text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.name, s.age_min, s.age_max, s.location, s.starts_at, s.ends_at
    FROM sessions s
    JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
    JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public
     AND p.status = 'live' AND p.archived_at IS NULL
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

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
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

CREATE FUNCTION buxa_delete_draft_session_v1(p_org_id uuid, p_session_id uuid)
RETURNS TABLE (deleted_class_id uuid, deleted_class_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to delete a session with its classes' USING ERRCODE = '42501';
  END IF;
  SELECT c.status INTO current_status FROM classes c WHERE c.id = p_session_id AND c.org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft session can be deleted with everything under it'
      USING ERRCODE = '23503', CONSTRAINT = 'session_not_draft';
  END IF;
  IF EXISTS (
       SELECT 1 FROM sessions s
        WHERE s.org_id = p_org_id AND s.class_id = p_session_id
          AND (EXISTS (SELECT 1 FROM enrolments e WHERE e.session_id = s.id)
            OR EXISTS (SELECT 1 FROM seat_holds h WHERE h.session_id = s.id)
            OR EXISTS (SELECT 1 FROM registration_classes rc WHERE rc.class_id = s.id))
     )
     OR EXISTS (SELECT 1 FROM registration_sessions rs WHERE rs.org_id = p_org_id AND rs.session_id = p_session_id)
     OR EXISTS (SELECT 1 FROM check_ins ci WHERE ci.org_id = p_org_id AND ci.session_id = p_session_id)
     OR EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = p_org_id AND m.session_id = p_session_id)
  THEN
    RAISE EXCEPTION 'This session has enrolments, archive it instead'
      USING ERRCODE = '23503', CONSTRAINT = 'session_has_enrolments';
  END IF;

  -- The classes go first (the 0035 trigger refuses a session that still has any). Deleting the session then removes its groups,
  -- rooms, assignments, instructor links and form links, which all cascade from it.
  RETURN QUERY
    DELETE FROM sessions AS s
     WHERE s.org_id = p_org_id AND s.class_id = p_session_id
     RETURNING s.id, s.name;
  DELETE FROM classes AS c WHERE c.id = p_session_id AND c.org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_draft_session_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_draft_session_v1(uuid, uuid) TO buxa_app;
