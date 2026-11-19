-- A person's first and last name, and their own clock format (12-hour or 24-hour).

-- The full name in users.name stays as it is, for compatibility. first_name and last_name are the split of it. Each is
-- at most 60 characters, so the full name is at most 121. NULL clock_format means "follow the browser", the default.
ALTER TABLE users ADD COLUMN first_name text;
ALTER TABLE users ADD COLUMN last_name text;
ALTER TABLE users ADD COLUMN clock_format text CHECK (clock_format IN ('12h', '24h'));

-- Backfill from the existing name: the first word is the first name, the rest (if any) is the last name.
UPDATE users
   SET first_name = left(split_part(btrim(name), ' ', 1), 60),
       last_name  = nullif(left(btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 2)), 60), '');

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_first_name_check CHECK (length(btrim(first_name)) BETWEEN 1 AND 60);
ALTER TABLE users ADD CONSTRAINT users_last_name_check CHECK (last_name IS NULL OR length(btrim(last_name)) BETWEEN 1 AND 60);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_check;
ALTER TABLE users ADD CONSTRAINT users_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 121);

-- Keeps the three names in step, whichever function writes them (sign-in, the profile, a camp rename):
--   * first or last name changed: the full name is rebuilt from them;
--   * a new row, or only the full name changed (a camp rename): the first and last names are split from it again.
CREATE FUNCTION users_sync_names() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.first_name IS NOT NULL
     AND (NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name) THEN
    NEW.name := btrim(NEW.first_name || CASE WHEN NEW.last_name IS NULL THEN '' ELSE ' ' || NEW.last_name END);
  ELSIF TG_OP = 'INSERT' OR NEW.first_name IS NULL OR NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.first_name := split_part(btrim(NEW.name), ' ', 1);
    NEW.last_name  := nullif(btrim(substr(btrim(NEW.name), length(split_part(btrim(NEW.name), ' ', 1)) + 2)), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_sync_names_trg BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_sync_names();

-- Sign-in returns the names and the clock format too, because the session reads them on every request. Its return type
-- changes, so the function is dropped and recreated rather than redefined in place.
DROP FUNCTION buxa_upsert_user(uuid, text, text);
CREATE FUNCTION buxa_upsert_user(p_auth_id uuid, p_email text, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text, user_first_name text, user_last_name text, user_clock_format text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  INSERT INTO users (auth_id, email, name) VALUES (p_auth_id, p_email, p_name)
  ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email
  RETURNING users.id, users.email, users.name, users.first_name, users.last_name, users.clock_format;
$$;

-- Saving the profile: replaces buxa_set_user_name(uuid, text) from 0015 with a first and last name. It still changes only the
-- named user, and the server passes only the signed-in person's own id.
DROP FUNCTION buxa_set_user_name(uuid, text);
CREATE FUNCTION buxa_set_user_name(p_user_id uuid, p_first_name text, p_last_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text, user_first_name text, user_last_name text, user_clock_format text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET first_name = p_first_name, last_name = nullif(p_last_name, '') WHERE id = p_user_id
  RETURNING users.id, users.email, users.name, users.first_name, users.last_name, users.clock_format;
$$;

-- The person's own clock format. Only the signed-in person's id is passed, as for the name.
CREATE FUNCTION buxa_set_user_clock_format(p_user_id uuid, p_clock_format text)
RETURNS TABLE (user_id uuid, user_email text, user_name text, user_first_name text, user_last_name text, user_clock_format text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET clock_format = p_clock_format WHERE id = p_user_id
  RETURNING users.id, users.email, users.name, users.first_name, users.last_name, users.clock_format;
$$;

REVOKE ALL ON FUNCTION buxa_upsert_user(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_set_user_name(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_set_user_clock_format(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_upsert_user(uuid, text, text) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_set_user_name(uuid, text, text) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_set_user_clock_format(uuid, text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_upsert_user(uuid, text, text), buxa_set_user_name(uuid, text, text), buxa_set_user_clock_format(uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;
