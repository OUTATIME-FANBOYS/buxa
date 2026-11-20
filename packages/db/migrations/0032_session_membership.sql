-- Session membership, expand step (audit items 5.1 and 5.3).
--
-- This migration only adds. Released v0.2.3 code still calls the old owner-rights functions and reads under the current row
-- policies, so nothing it uses is dropped or changed here:
--   - The new functions take the signed-in user from current_user_id() (app.user_id, set by withOrg), not from an argument.
--     They are overloads of the old names where the argument list differs, or _v2 names where it does not.
--   - The row policies are unchanged. They stop trusting a bare app.org_id only in the contract step (migration pending in
--     packages/db/migrations/0034_session_membership_contract.sql), after the old release is retired.
-- Until then the old SECURITY DEFINER functions still accept a user id argument; that is the open part of audit 5.1.
-- The one drop below is of buxa_set_member_option from 0030, which has not shipped, so no released code calls it.
-- drop-approved: v0.3

-- The signed-in user for this transaction; NULL when none is set.
CREATE FUNCTION current_user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- The signed-in user's role in a camp, or NULL when they are not a member of it. It is SECURITY DEFINER so the policies
-- below can use it: it reads org_members without applying org_members' own policy (which calls it), so there is no recursion.
CREATE FUNCTION is_member(p_org uuid) RETURNS org_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.role FROM org_members m WHERE m.org_id = p_org AND m.user_id = current_user_id();
$$;

REVOKE ALL ON FUNCTION is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_id() TO buxa_app;
GRANT EXECUTE ON FUNCTION is_member(uuid) TO buxa_app;

-- Sign-in: the signed-in user's memberships, camp-independent. The user is the session user, not an argument.
CREATE FUNCTION buxa_memberships_of()
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = current_user_id() AND o.archived_at IS NULL
   ORDER BY o.name;
$$;

CREATE FUNCTION buxa_archived_camps_of()
RETURNS TABLE (camp_id uuid, camp_name text, camp_archived_at timestamptz, camp_role org_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.archived_at, m.role
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = current_user_id() AND o.archived_at IS NOT NULL
   ORDER BY o.name;
$$;

CREATE FUNCTION buxa_archived_memberships_of()
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = current_user_id() AND o.archived_at IS NOT NULL
   ORDER BY o.name;
$$;

-- Creating a camp: the new camp's owner is the signed-in user. There is no membership yet, so only the user is checked.
CREATE FUNCTION buxa_create_org(p_name text, p_slug text, p_timezone text)
RETURNS TABLE (org_id uuid, org_name text, org_slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid;
  v_user uuid := current_user_id();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a camp' USING ERRCODE = '42501';
  END IF;
  INSERT INTO orgs (name, slug, timezone) VALUES (p_name, p_slug, p_timezone) RETURNING id INTO v_org;
  INSERT INTO org_members (org_id, user_id, role) VALUES (v_org, v_user, 'owner');
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (v_org, v_user, 'org.create', 'org', v_org::text, '{}'::jsonb);
  RETURN QUERY SELECT o.id, o.name, o.slug FROM orgs o WHERE o.id = v_org;
END;
$$;

-- Archive, unarchive and delete a camp: owner only, checked against the signed-in user's own membership.
CREATE FUNCTION buxa_archive_camp(p_org_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF is_member(p_org_id) IS DISTINCT FROM 'owner'::org_role THEN
    RAISE EXCEPTION 'Only the camp owner can archive it' USING ERRCODE = '42501';
  END IF;
  SELECT archived_at INTO v_at FROM orgs WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Camp not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'This camp is already archived' USING ERRCODE = '22023';
  END IF;
  UPDATE orgs SET archived_at = now() WHERE id = p_org_id RETURNING archived_at INTO v_at;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, current_user_id(), 'org.archive', 'org', p_org_id::text, '{}'::jsonb);

  RETURN v_at;
END;
$$;

CREATE FUNCTION buxa_unarchive_camp(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF is_member(p_org_id) IS DISTINCT FROM 'owner'::org_role THEN
    RAISE EXCEPTION 'Only the camp owner can unarchive it' USING ERRCODE = '42501';
  END IF;
  SELECT archived_at INTO v_at FROM orgs WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Camp not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'This camp is not archived' USING ERRCODE = '22023';
  END IF;
  UPDATE orgs SET archived_at = NULL WHERE id = p_org_id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, current_user_id(), 'org.unarchive', 'org', p_org_id::text, '{}'::jsonb);
END;
$$;

CREATE FUNCTION buxa_delete_camp(p_org_id uuid, p_confirm_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name text;
BEGIN
  IF is_member(p_org_id) IS DISTINCT FROM 'owner'::org_role THEN
    RAISE EXCEPTION 'Only the camp owner can delete it' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM orgs WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Camp not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_name IS DISTINCT FROM p_confirm_name THEN
    RAISE EXCEPTION 'The camp name does not match' USING ERRCODE = '22023';
  END IF;
  DELETE FROM orgs WHERE id = p_org_id;
END;
$$;

-- The signed-in user's own name and clock format. Each changes only the row whose id is current_user_id(); with no user
-- set, no row matches and nothing changes.
CREATE FUNCTION buxa_set_user_name(p_first_name text, p_last_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text, user_first_name text, user_last_name text, user_clock_format text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET first_name = p_first_name, last_name = nullif(p_last_name, '') WHERE id = current_user_id()
  RETURNING users.id, users.email, users.name, users.first_name, users.last_name, users.clock_format;
$$;

CREATE FUNCTION buxa_set_user_clock_format(p_clock_format text)
RETURNS TABLE (user_id uuid, user_email text, user_name text, user_first_name text, user_last_name text, user_clock_format text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET clock_format = p_clock_format WHERE id = current_user_id()
  RETURNING users.id, users.email, users.name, users.first_name, users.last_name, users.clock_format;
$$;

-- Renaming a member: the signed-in user must be an admin or owner of the camp, and the target must be a member of it.
-- The target is the person being renamed, not the caller, so it stays an argument.
CREATE FUNCTION buxa_rename_member_v2(p_org_id uuid, p_target_user_id uuid, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE users SET name = p_name
   WHERE id = p_target_user_id
     AND EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = p_org_id AND m.user_id = p_target_user_id)
     AND is_member(p_org_id) IN ('admin', 'owner')
  RETURNING users.id, users.email, users.name;
$$;

-- Class and form writes. Each checks the signed-in user's role first, as the app does (classes:manage: staff, admin, owner;
-- registration:manage: admin, owner). Teachers and viewers are refused.
CREATE FUNCTION buxa_delete_class_v2(p_org_id uuid, p_class_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrolments WHERE session_id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'The class has enrolments' USING ERRCODE = '23503', CONSTRAINT = 'sessions_has_enrolments';
  END IF;
  DELETE FROM sessions WHERE id = p_class_id AND org_id = p_org_id;
END $$;

CREATE FUNCTION buxa_replace_class_instructors_v2(p_org_id uuid, p_class_id uuid, p_person_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM people WHERE org_id = p_org_id AND id = ANY (p_person_ids)) <> cardinality(p_person_ids) THEN
    RAISE EXCEPTION 'Instructor not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM session_instructors WHERE session_id = p_class_id AND org_id = p_org_id;
  INSERT INTO session_instructors (org_id, session_id, person_id)
    SELECT p_org_id, p_class_id, unnest(p_person_ids);
END $$;

CREATE FUNCTION buxa_replace_class_teachers_v2(p_org_id uuid, p_class_id uuid, p_user_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_class_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM org_members m
       WHERE m.org_id = p_org_id AND m.user_id = ANY (p_user_ids) AND m.role = 'teacher') <> cardinality(p_user_ids) THEN
    RAISE EXCEPTION 'Teacher not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM class_teachers WHERE session_id = p_class_id AND org_id = p_org_id;
  INSERT INTO class_teachers (org_id, session_id, user_id)
    SELECT p_org_id, p_class_id, unnest(p_user_ids);
END $$;

CREATE FUNCTION buxa_replace_form_sessions_v2(p_org_id uuid, p_form_id uuid, p_session_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage registration' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM registration_forms WHERE id = p_form_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Registration form not found' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM classes WHERE org_id = p_org_id AND id = ANY (p_session_ids)) <> cardinality(p_session_ids) THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM registration_form_sessions WHERE form_id = p_form_id AND org_id = p_org_id;
  INSERT INTO registration_form_sessions (org_id, form_id, session_id)
    SELECT p_org_id, p_form_id, unnest(p_session_ids);
END $$;

-- Grants. Every function that changed signature is granted again, and PUBLIC and the Supabase API roles are revoked from it.
REVOKE ALL ON FUNCTION buxa_memberships_of(), buxa_archived_camps_of(), buxa_archived_memberships_of(),
  buxa_create_org(text, text, text), buxa_archive_camp(uuid), buxa_unarchive_camp(uuid), buxa_delete_camp(uuid, text),
  buxa_set_user_name(text, text), buxa_set_user_clock_format(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_memberships_of(), buxa_archived_camps_of(), buxa_archived_memberships_of(),
  buxa_create_org(text, text, text), buxa_archive_camp(uuid), buxa_unarchive_camp(uuid), buxa_delete_camp(uuid, text),
  buxa_set_user_name(text, text), buxa_set_user_clock_format(text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_memberships_of(), buxa_archived_camps_of(), buxa_archived_memberships_of(), buxa_create_org(text, text, text), buxa_archive_camp(uuid), buxa_unarchive_camp(uuid), buxa_delete_camp(uuid, text), buxa_set_user_name(text, text), buxa_set_user_clock_format(text), is_member(uuid), current_user_id() FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- The _v2 functions below are new names, so PostgreSQL gives them EXECUTE for PUBLIC by default. Revoke that and grant the
-- request role only, as for the functions above.
REVOKE ALL ON FUNCTION buxa_rename_member_v2(uuid, uuid, text), buxa_delete_class_v2(uuid, uuid),
  buxa_replace_class_instructors_v2(uuid, uuid, uuid[]), buxa_replace_class_teachers_v2(uuid, uuid, uuid[]),
  buxa_replace_form_sessions_v2(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_rename_member_v2(uuid, uuid, text), buxa_delete_class_v2(uuid, uuid),
  buxa_replace_class_instructors_v2(uuid, uuid, uuid[]), buxa_replace_class_teachers_v2(uuid, uuid, uuid[]),
  buxa_replace_form_sessions_v2(uuid, uuid, uuid[]) TO buxa_app;

-- Setting or clearing a teacher's option. The signed-in user must be an admin or owner (members:set_options) and not the
-- target; the target must be a teacher. It replaces the 0030 version, which took the setter's id as an argument.
DROP FUNCTION buxa_set_member_option(uuid, uuid, text, boolean, uuid);
CREATE FUNCTION buxa_set_member_option(p_org_id uuid, p_user_id uuid, p_option text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to set options' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = current_user_id() THEN
    RAISE EXCEPTION 'Not allowed to change your own options' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = p_org_id AND m.user_id = p_user_id AND m.role = 'teacher') THEN
    RAISE EXCEPTION 'Teacher not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO member_options (org_id, user_id, option_key, enabled, set_by, set_at)
    VALUES (p_org_id, p_user_id, p_option, p_enabled, current_user_id(), now())
  ON CONFLICT (org_id, user_id, option_key)
    DO UPDATE SET enabled = EXCLUDED.enabled, set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at;
END $$;

REVOKE ALL ON FUNCTION buxa_set_member_option(uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_member_option(uuid, uuid, text, boolean) TO buxa_app;

-- The trigger function from 0027 that removes a member's class assignments is SECURITY DEFINER too. It takes no arguments and
-- only runs when org_members changes, but nothing else should be able to call it, so PUBLIC loses EXECUTE. Triggers still fire.
REVOKE ALL ON FUNCTION org_members_drop_teacher_classes() FROM PUBLIC;

-- The member-option trigger function from 0030 has the same shape (SECURITY DEFINER, no arguments, runs on a trigger): PUBLIC
-- loses EXECUTE for the same reason.
REVOKE ALL ON FUNCTION member_options_drop_teacher() FROM PUBLIC;

-- The calendar feed has no signed-in user: a calendar app reads it with the camp's secret token. The token hash resolves
-- the camp here, and only that camp's sessions are returned, and only while it is not archived. This replaces the feed's
-- read of sessions under row-level security, which now needs a signed-in member.
CREATE FUNCTION buxa_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM camp_calendar_tokens t
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN sessions s ON s.org_id = t.org_id
   WHERE t.token_hash = p_hash
   ORDER BY s.starts_at, s.id;
$$;

REVOKE ALL ON FUNCTION buxa_calendar_feed_classes(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_calendar_feed_classes(bytea) TO buxa_app;
