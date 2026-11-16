-- Foundation: organisations (tenants), users, memberships, audit log.
-- Every tenant-owned table carries org_id and is protected by row-level security.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Request handling runs as this role (via SET LOCAL ROLE). It cannot bypass RLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buxa_app') THEN
    CREATE ROLE buxa_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'staff', 'viewer');

CREATE TABLE orgs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' in email) > 1),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user_idx ON org_members(user_id);

CREATE TABLE audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id    uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  action    text NOT NULL,
  entity    text NOT NULL,
  entity_id text,
  data      jsonb NOT NULL DEFAULT '{}',
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_at_idx ON audit_log(org_id, at DESC);

-- Audit rows can be added, never edited or deleted directly (this also binds the owner role).
-- Changes made by a foreign-key action (deleting an org or a user on purpose, e.g. erasure) are allowed.
CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- The current organisation for this transaction; NULL when none is set.
CREATE FUNCTION current_org() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

ALTER TABLE orgs        ENABLE ROW LEVEL SECURITY; ALTER TABLE orgs        FORCE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY; ALTER TABLE users       FORCE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY; ALTER TABLE org_members FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_log   FORCE ROW LEVEL SECURITY;

CREATE POLICY orgs_self ON orgs FOR SELECT TO buxa_app USING (id = current_org());
CREATE POLICY orgs_update ON orgs FOR UPDATE TO buxa_app USING (id = current_org()) WITH CHECK (id = current_org());

-- A user is visible only through membership of the current organisation.
CREATE POLICY users_in_org ON users FOR SELECT TO buxa_app
  USING (EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = users.id AND m.org_id = current_org()));

CREATE POLICY members_tenant ON org_members FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

CREATE POLICY audit_read ON audit_log FOR SELECT TO buxa_app USING (org_id = current_org());
CREATE POLICY audit_write ON audit_log FOR INSERT TO buxa_app WITH CHECK (org_id = current_org());

GRANT SELECT, UPDATE ON orgs TO buxa_app;
GRANT SELECT ON users TO buxa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_members TO buxa_app;
GRANT SELECT, INSERT ON audit_log TO buxa_app;
GRANT EXECUTE ON FUNCTION current_org() TO buxa_app;
