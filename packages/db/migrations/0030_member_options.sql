-- Phase 3: per-person options an admin turns on for a teacher (docs/phases/03-registration.md). The first option is check-in and
-- check-out (attendance:record), off by default. The keys are the ones in MEMBER_OPTIONS (packages/domain/src/permissions.ts); the
-- CHECK below must list the same keys. Every table carries org_id, has forced row-level security and a policy scoped to the
-- current organisation. Writes go through a SECURITY DEFINER function that refuses anyone who is not a teacher in that camp, as
-- class_teachers does (0027).

CREATE TABLE member_options (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  option_key text NOT NULL CHECK (option_key IN ('teacher.check_in_out')),
  enabled    boolean NOT NULL DEFAULT false,
  set_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  set_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id, option_key),
  FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE
);

ALTER TABLE member_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_options FORCE ROW LEVEL SECURITY;
CREATE POLICY member_options_tenant ON member_options FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- Least privilege, as for class_teachers (0027): request code reads options, and writes them only through the function below.
GRANT SELECT ON member_options TO buxa_app;

-- Setting (or clearing) one option on one person. Only a teacher of this camp may hold an option; the server checks the role and
-- the rank first (members:set_options in packages/domain), and this function refuses anyone else.
CREATE FUNCTION buxa_set_member_option(p_org_id uuid, p_user_id uuid, p_option text, p_enabled boolean, p_set_by uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = p_org_id AND m.user_id = p_user_id AND m.role = 'teacher') THEN
    RAISE EXCEPTION 'Teacher not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO member_options (org_id, user_id, option_key, enabled, set_by, set_at)
    VALUES (p_org_id, p_user_id, p_option, p_enabled, p_set_by, now())
  ON CONFLICT (org_id, user_id, option_key)
    DO UPDATE SET enabled = EXCLUDED.enabled, set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at;
END $$;

-- A member who stops being a teacher loses their options at once (as they lose their class assignments in 0027).
CREATE FUNCTION member_options_drop_teacher() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.role = 'teacher' AND NEW.role <> 'teacher' THEN
    DELETE FROM member_options WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER org_members_drop_teacher_options AFTER UPDATE OF role ON org_members
  FOR EACH ROW EXECUTE FUNCTION member_options_drop_teacher();

REVOKE ALL ON FUNCTION buxa_set_member_option(uuid, uuid, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_member_option(uuid, uuid, text, boolean, uuid) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_set_member_option(uuid, uuid, text, boolean, uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
