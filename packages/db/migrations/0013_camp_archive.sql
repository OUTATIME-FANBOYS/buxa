-- Camp archive and delete.
--
-- archived_at: when the owner archived the camp. It is a column on the camp's own row, so it follows the same row-level
-- security policies and table-level grants as every other column on orgs (0001). Nothing else about the camp changes:
-- its people, households, memberships, credentials, attendance, classes and audit log all stay.
ALTER TABLE orgs ADD COLUMN archived_at timestamptz NULL;

-- Sign-in memberships leave out archived camps, so an archived camp is hidden from every camp-scoped action.
-- Same signature as 0009, so the function keeps its privileges; only the WHERE clause changes.
CREATE OR REPLACE FUNCTION buxa_memberships_of(p_user_id uuid)
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = p_user_id AND o.archived_at IS NULL
   ORDER BY o.name;
$$;

-- The archived camps a person belongs to, read-only: id, name, when archived, and their role there (the role is only used
-- to decide whether they may delete the camp).
CREATE FUNCTION buxa_archived_camps_of(p_user_id uuid)
RETURNS TABLE (camp_id uuid, camp_name text, camp_archived_at timestamptz, camp_role org_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.archived_at, m.role
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = p_user_id AND o.archived_at IS NOT NULL
   ORDER BY o.name;
$$;

-- Archive a camp, owner only, with its audit row in the same statement (one transaction). Refuses an archived camp.
CREATE FUNCTION buxa_archive_camp(p_org_id uuid, p_actor_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = p_actor_id AND role = 'owner') THEN
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
    VALUES (p_org_id, p_actor_id, 'org.archive', 'org', p_org_id::text, '{}'::jsonb);

  RETURN v_at;
END;
$$;

-- Delete a camp and everything in it, owner only, and only when the typed name matches the camp's name exactly.
-- One statement: every table that holds camp data references orgs ON DELETE CASCADE (0001, 0007, 0008, 0011), so
-- people, households, memberships, credentials, check-ins, classes, sessions, enrolments, instructors, the membership
-- rows and the audit log all go with the camp, children before parents. audit_log is append-only except for those
-- foreign-key cascades (0001), which is why its rows are removed here and not by a direct DELETE.
CREATE FUNCTION buxa_delete_camp(p_org_id uuid, p_actor_id uuid, p_confirm_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = p_actor_id AND role = 'owner') THEN
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

REVOKE ALL ON FUNCTION buxa_archived_camps_of(uuid), buxa_archive_camp(uuid, uuid), buxa_delete_camp(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_archived_camps_of(uuid), buxa_archive_camp(uuid, uuid), buxa_delete_camp(uuid, uuid, text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_archived_camps_of(uuid), buxa_archive_camp(uuid, uuid), buxa_delete_camp(uuid, uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;
