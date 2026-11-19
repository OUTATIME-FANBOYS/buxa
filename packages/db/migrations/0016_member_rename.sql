-- Renaming a person in the camp, by an admin or owner.

-- The request role (buxa_app) may not write users (0001). This function changes one user's name, but only when that user is
-- a member of the given camp, so a name can never be changed outside it. The server checks the role and the rank first
-- (members:rename in packages/domain); this function trusts the caller only for who it is asked to rename, and it refuses any
-- user who is not in the camp. No table or column changes.
CREATE FUNCTION buxa_rename_member(p_org_id uuid, p_target_user_id uuid, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET name = p_name
   WHERE id = p_target_user_id
     AND EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = p_org_id AND m.user_id = p_target_user_id)
  RETURNING users.id, users.email, users.name;
$$;

REVOKE ALL ON FUNCTION buxa_rename_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_rename_member(uuid, uuid, text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_rename_member(uuid, uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;
