-- The person's own name, saved from their profile.

-- The request role (buxa_app) reads users (0001) but may not write them, and sign-in (buxa_upsert_user, 0009) only sets a name
-- when it first creates the row, so a saved name is kept on later sign-ins. This function is the one way to change it: it
-- changes only the named user's name, and the server passes only the signed-in person's own id. No table or column changes.
CREATE FUNCTION buxa_set_user_name(p_user_id uuid, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET name = p_name WHERE id = p_user_id
  RETURNING users.id, users.email, users.name;
$$;

REVOKE ALL ON FUNCTION buxa_set_user_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_user_name(uuid, text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_set_user_name(uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;
