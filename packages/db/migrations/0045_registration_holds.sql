-- Phase 3: seat hold release reason 'completed', and the camp lookup the expired-hold job needs.
--
-- A hold is released 'completed' when its registration is confirmed and the enrolment is created (the registration side is not
-- wired yet; see docs/phases/03-registration.md). The job that tidies expired holds runs for every camp, with no user behind it,
-- so it needs the camp ids of the camps that have expired holds. Row-level security would hide them from the request role.
--
-- Expand only: the check on release_reason gains one value, and one function is added. Nothing is dropped.

-- The check from 0025 is replaced in place (its generated name is seat_holds_release_reason_check).
-- drop-approved: phase 3 (the check only gains a value; the code that runs today never writes 'completed', so nothing it uses is removed)
ALTER TABLE seat_holds DROP CONSTRAINT seat_holds_release_reason_check;
ALTER TABLE seat_holds ADD CONSTRAINT seat_holds_release_reason_check
  CHECK (release_reason IN ('cancelled', 'expired', 'completed'));

-- The camps that have expired holds the cleanup has not released yet, each with one of its members. Row-level security lets a
-- camp's rows be read only by a member, and the job has no user, so it runs as that member (the function reads only these ids).
CREATE OR REPLACE FUNCTION buxa_orgs_with_expired_holds()
RETURNS TABLE (org_id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT e.org_id, (SELECT m.user_id FROM org_members m WHERE m.org_id = e.org_id ORDER BY m.created_at, m.user_id LIMIT 1)
    FROM (SELECT DISTINCT h.org_id FROM seat_holds h WHERE h.released_at IS NULL AND h.expires_at <= now()) e
   ORDER BY e.org_id
$$;

REVOKE ALL ON FUNCTION buxa_orgs_with_expired_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_orgs_with_expired_holds() TO buxa_app;

-- Supabase's API roles must not reach it either (as in migration 0009).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_orgs_with_expired_holds() FROM %I', r);
    END IF;
  END LOOP;
END $$;
