-- Phase 3: which teacher runs which class. A teacher is a camp member with the teacher role (org_members.role), so the assignment
-- is keyed by the user, not by a person record. Staff and admins assign teachers (classes:manage). Every table carries org_id,
-- has forced row-level security and a policy scoped to the current organisation.

CREATE TABLE class_teachers (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  user_id    uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (org_id, session_id) REFERENCES sessions (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE
);
CREATE INDEX class_teachers_org_user_idx ON class_teachers (org_id, user_id);

ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers FORCE ROW LEVEL SECURITY;
CREATE POLICY class_teachers_tenant ON class_teachers FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- Least privilege, as for session_instructors (0011): request code never hard-deletes an assignment directly.
GRANT SELECT, INSERT ON class_teachers TO buxa_app;

-- Replacing a class's teachers. Only members with the teacher role may be assigned.
CREATE FUNCTION buxa_replace_class_teachers(p_org_id uuid, p_class_id uuid, p_user_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
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

-- A member who stops being a teacher loses their class assignments at once.
CREATE FUNCTION org_members_drop_teacher_classes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.role = 'teacher' AND NEW.role <> 'teacher' THEN
    DELETE FROM class_teachers WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER org_members_drop_teacher_classes AFTER UPDATE OF role ON org_members
  FOR EACH ROW EXECUTE FUNCTION org_members_drop_teacher_classes();

REVOKE ALL ON FUNCTION buxa_replace_class_teachers(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_replace_class_teachers(uuid, uuid, uuid[]) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_replace_class_teachers(uuid, uuid, uuid[]) FROM %I', r);
    END IF;
  END LOOP;
END $$;
