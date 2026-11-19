-- Viewing an archived camp, read-only.

-- The archived camps a person belongs to, with the camp's slug, so one can be opened read-only. buxa_memberships_of (0013)
-- stays the write-side list and still leaves archived camps out. Same privileges as 0013: the function owner runs it, because
-- the camp is not the current one when the person picks it.
CREATE FUNCTION buxa_archived_memberships_of(p_user_id uuid)
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = p_user_id AND o.archived_at IS NOT NULL
   ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION buxa_archived_memberships_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_archived_memberships_of(uuid) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_archived_memberships_of(uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
