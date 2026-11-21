-- Deleting a session (a row of `classes`) that still holds classes (rows of `sessions`).
--
-- The foreign key from sessions to classes cascades, so without this migration a DELETE on a session would delete its classes
-- and their enrolments with it. This migration adds the refusal at the database: a session with any class cannot be deleted.
-- It only adds: a trigger and a function. Nothing is dropped.
--
-- The trigger ignores deletes that come from a cascade (pg_trigger_depth() > 1). Deleting a camp cascades from orgs to classes,
-- and that must still work. Only a direct delete of a session is refused.

CREATE FUNCTION classes_refuse_delete_with_classes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM sessions WHERE class_id = OLD.id) THEN
    RAISE EXCEPTION 'The session has classes' USING ERRCODE = '23503', CONSTRAINT = 'classes_has_classes';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER classes_refuse_delete_with_classes BEFORE DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION classes_refuse_delete_with_classes();

-- Deleting a session. Request code has no DELETE grant on classes, so the delete runs here as the owner, like buxa_delete_class_v2
-- (0032). The signed-in user must be staff, admin or owner (classes:manage). The trigger above refuses a session with classes.
CREATE FUNCTION buxa_delete_session_v2(p_org_id uuid, p_session_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_session_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM classes WHERE id = p_session_id AND org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_session_v2(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_session_v2(uuid, uuid) TO buxa_app;
