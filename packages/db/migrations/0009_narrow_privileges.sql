-- Narrow the privileged paths (audit S-06).
--
-- Three things the request runtime must do cannot be scoped to one organisation by row-level security, because no
-- organisation is known yet (or the lookup spans all of them):
--   1. create or refresh the user row for a verified sign-in,
--   2. list a person's memberships across organisations at sign-in,
--   3. create an organisation and its owner.
-- Before this migration those ran on the login the app connects with, which bypasses row-level security. Now they are
-- three functions. Each one runs with its owner's rights (SECURITY DEFINER), has a fixed search_path, does one job, and is
-- executable by buxa_app only. The runtime login therefore needs no bypass. See docs/deploy.md and docs/security.md.
--
-- The owner of these functions is the login that applies migrations. That login must still be able to bypass row-level
-- security, because a SECURITY DEFINER function runs with its owner's row-level security too (see docs/deploy.md).

CREATE OR REPLACE FUNCTION buxa_upsert_user(p_auth_id uuid, p_email text, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  INSERT INTO users (auth_id, email, name) VALUES (p_auth_id, p_email, p_name)
  ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email
  RETURNING users.id, users.email, users.name;
$$;

CREATE OR REPLACE FUNCTION buxa_memberships_of(p_user_id uuid)
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = p_user_id
   ORDER BY o.name;
$$;

CREATE OR REPLACE FUNCTION buxa_create_org(p_name text, p_slug text, p_timezone text, p_owner_id uuid)
RETURNS TABLE (org_id uuid, org_name text, org_slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid;
BEGIN
  INSERT INTO orgs (name, slug, timezone) VALUES (p_name, p_slug, p_timezone) RETURNING id INTO v_org;
  INSERT INTO org_members (org_id, user_id, role) VALUES (v_org, p_owner_id, 'owner');
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (v_org, p_owner_id, 'org.create', 'org', v_org::text, '{}'::jsonb);
  RETURN QUERY SELECT o.id, o.name, o.slug FROM orgs o WHERE o.id = v_org;
END;
$$;

-- Only the request role may run them. PUBLIC has EXECUTE on new functions by default, so it is revoked first.
REVOKE ALL ON FUNCTION buxa_upsert_user(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_memberships_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_create_org(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_upsert_user(uuid, text, text) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_memberships_of(uuid) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_create_org(text, text, text, uuid) TO buxa_app;

-- Supabase's API roles must not reach them either (migration 0005 removes their access to everything else).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_upsert_user(uuid, text, text), buxa_memberships_of(uuid), buxa_create_org(text, text, text, uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
