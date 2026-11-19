-- Phase 3: registration forms and registrations (sign-up, no money).
-- Same rules as phases 1 and 2: org_id on every row, forced row-level security with one policy per table, composite
-- (org_id, id) foreign keys so a link can never point at another organisation, and no hard deletes for the request role.
--
-- A registration form belongs to one season and covers a set of sessions (rows of `classes`, the app's Session). Its custom
-- field definitions are a jsonb array, validated by zod in packages/contracts. Publishing freezes the definitions as a numbered
-- version; every registration stores the version it was answered against, so later edits never change old answers.
--
-- Holds and the waitlist are not built yet. registration_sessions.status is the seam: it is per session place, so a hold or a
-- waitlist entry adds a value to its check and a column, without touching the registration itself.

CREATE TABLE registration_forms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  season            text CHECK (season IS NULL OR length(btrim(season)) BETWEEN 1 AND 60),
  -- The draft definition, edited in place. The published definition is the version row named by published_version.
  draft_fields      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(draft_fields) = 'array'),
  -- NULL until the first publish. A form accepts registrations only after it has been published.
  published_version integer CHECK (published_version IS NULL OR published_version > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);
CREATE INDEX registration_forms_org_name_idx ON registration_forms (org_id, lower(name));

-- The sessions a form covers. Replaced as a set by buxa_replace_form_sessions below, so the request role needs no DELETE.
CREATE TABLE registration_form_sessions (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  form_id    uuid NOT NULL,
  session_id uuid NOT NULL,
  PRIMARY KEY (form_id, session_id),
  FOREIGN KEY (org_id, form_id) REFERENCES registration_forms (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE CASCADE
);
CREATE INDEX registration_form_sessions_org_session_idx ON registration_form_sessions (org_id, session_id);

-- Frozen definitions. Written once per publish, never updated.
CREATE TABLE registration_form_versions (
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  form_id      uuid NOT NULL,
  version      integer NOT NULL CHECK (version > 0),
  fields       jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array'),
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, form_id, version),
  FOREIGN KEY (org_id, form_id) REFERENCES registration_forms (org_id, id) ON DELETE CASCADE
);

-- One family's request. `answers` holds the standard fields and the custom answers, checked against the version's definitions.
CREATE TABLE registrations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  form_id      uuid NOT NULL,
  form_version integer NOT NULL CHECK (form_version > 0),
  answers      jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, form_id, form_version)
    REFERENCES registration_form_versions (org_id, form_id, version)
);
CREATE INDEX registrations_org_form_idx ON registrations (org_id, form_id, created_at);

-- One row per session a registration asks for. `status` is per session place, so holds and the waitlist (later) use it.
CREATE TABLE registration_sessions (
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL,
  session_id      uuid NOT NULL,
  status          text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, session_id),
  FOREIGN KEY (org_id, registration_id) REFERENCES registrations (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE CASCADE
);
CREATE INDEX registration_sessions_org_session_idx ON registration_sessions (org_id, session_id, created_at);

-- Forced row-level security on every new table, one policy each (same shape as migration 0008).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['registration_forms', 'registration_form_sessions', 'registration_form_versions', 'registrations', 'registration_sessions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO buxa_app USING (org_id = current_org()) WITH CHECK (org_id = current_org())', t || '_tenant', t);
  END LOOP;
END $$;

-- Least privilege: no hard deletes. Versions and registrations are append-only.
GRANT SELECT, INSERT, UPDATE ON registration_forms TO buxa_app;
GRANT SELECT, INSERT ON registration_form_versions, registrations, registration_sessions TO buxa_app;
GRANT SELECT, INSERT ON registration_form_sessions TO buxa_app;

-- Replacing a form's session set. Same reason as buxa_replace_class_instructors (0022): request code has no DELETE grant here.
CREATE FUNCTION buxa_replace_form_sessions(p_org_id uuid, p_form_id uuid, p_session_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
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

REVOKE ALL ON FUNCTION buxa_replace_form_sessions(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_replace_form_sessions(uuid, uuid, uuid[]) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_replace_form_sessions(uuid, uuid, uuid[]) FROM %I', r);
    END IF;
  END LOOP;
END $$;
