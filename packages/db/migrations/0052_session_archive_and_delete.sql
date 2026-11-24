-- Sessions (rows of `classes`, the parents) can be archived, and a session with classes (rows of `sessions`) can be deleted
-- together with its classes by an admin or the owner. Session names are unique in a camp, ignoring case and spaces.
--
-- 1. archived_at: an archived session is hidden from registration and from its public page. Its classes and history are kept.
--    Nullable, so every existing session is live. Set and cleared by the app (classes:manage archives, org:update unarchives).
-- 2. A unique index on the normalised name. Before it is added, every camp is checked. If any two sessions in a camp share a
--    normalised name, the migration stops with the list and adds nothing (the whole migration rolls back). Nothing is renamed.
-- 3. buxa_delete_session_with_classes_v1: deletes a session's classes and then the session, in one statement, for an admin or the
--    owner. It refuses (and deletes nothing) when any class has an enrolment, a seat hold, a registration, a check-in or a season
--    pass. Those links would otherwise be deleted or cleared. It returns the deleted classes so the app can audit each one.
-- 4. The public-page functions (0029, and buxa_public_classes_v2 from 0050) skip archived sessions. Same signatures and returns.
--
-- Expand only: nothing is dropped. The cascade from classes to sessions is still guarded by migration 0035.

ALTER TABLE classes ADD COLUMN archived_at timestamptz;

-- 2. The duplicate check runs camp by camp, with the camp set as the tenant so row-level security lets the scan see its rows
--    (the same approach as the backfill in 0022).
DO $$
DECLARE
  o record;
  found text;
  problems text := '';
BEGIN
  FOR o IN SELECT id, slug FROM orgs LOOP
    PERFORM set_config('app.org_id', o.id::text, true);
    SELECT string_agg(d.names, '; ' ORDER BY d.names) INTO found
      FROM (
        SELECT string_agg(c.name, ' | ' ORDER BY c.name) AS names
          FROM classes c
         WHERE c.org_id = o.id
         GROUP BY lower(btrim(regexp_replace(c.name, '\s+', ' ', 'g')))
        HAVING count(*) > 1
      ) d;
    IF found IS NOT NULL THEN
      problems := problems || format(E'\n  camp %s: %s', o.slug, found);
    END IF;
  END LOOP;
  PERFORM set_config('app.org_id', '', true);
  IF problems <> '' THEN
    RAISE EXCEPTION 'Duplicate session names exist, so the unique index was not added. Rename them and run again.%', problems
      USING ERRCODE = '23505', CONSTRAINT = 'classes_org_name_normal_key';
  END IF;
END $$;

CREATE UNIQUE INDEX classes_org_name_normal_key ON classes (org_id, (lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))));

-- 3. Delete a session with its classes. The owner's rights are used because request code has no DELETE grant on classes or sessions.
CREATE FUNCTION buxa_delete_session_with_classes_v1(p_org_id uuid, p_session_id uuid)
RETURNS TABLE (deleted_class_id uuid, deleted_class_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to delete a session with its classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = p_session_id AND c.org_id = p_org_id) THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
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

  -- The classes go first (the rows of `sessions`). Then the session (the row of `classes`), which the 0035 trigger lets through
  -- because no class is left.
  RETURN QUERY
    DELETE FROM sessions AS s
     WHERE s.org_id = p_org_id AND s.class_id = p_session_id
     RETURNING s.id, s.name;
  DELETE FROM classes AS c WHERE c.id = p_session_id AND c.org_id = p_org_id;
END $$;

-- 4. The public pages: the functions from 0029 and the per-class price version from 0050 (buxa_public_classes_v2), each with the
--    same signature and return type and with archived sessions left out. CREATE OR REPLACE keeps their grants.
CREATE OR REPLACE FUNCTION buxa_public_session(p_slug text, p_session_id uuid)
RETURNS TABLE (camp_name text, camp_timezone text, session_name text, session_description text, starts_on date, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.name, o.timezone, p.name, p.description, p.starts_on, p.ends_on
    FROM classes p JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public AND p.archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION buxa_public_classes(p_slug text, p_session_id uuid, p_from timestamptz)
RETURNS TABLE (class_name text, age_min integer, age_max integer, location text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.name, s.age_min, s.age_max, s.location, s.starts_at, s.ends_at
    FROM sessions s
    JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
    JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public AND p.archived_at IS NULL
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
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public AND p.archived_at IS NULL
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

REVOKE ALL ON FUNCTION buxa_delete_session_with_classes_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_session_with_classes_v1(uuid, uuid) TO buxa_app;
