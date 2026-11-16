-- Phase 1: people, households, memberships, badges (credentials) and check-ins.
-- Every table carries org_id, has forced row-level security and a policy scoped to the current organisation.
-- Cross-tenant references are impossible: child tables point at (org_id, id) of the parent, not just id.
-- Deliberately absent: medical or allergy notes, photos, home addresses, government ids (see docs/phases/01-members-checkin.md).

CREATE EXTENSION IF NOT EXISTS unaccent;

-- "Today" and "valid" mean the camp's local day.
ALTER TABLE orgs ADD COLUMN timezone text NOT NULL DEFAULT 'UTC' CHECK (length(timezone) BETWEEN 1 AND 64);

CREATE TABLE people (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  given_name     text NOT NULL CHECK (length(btrim(given_name)) BETWEEN 1 AND 80),
  family_name    text NOT NULL CHECK (length(btrim(family_name)) BETWEEN 1 AND 80),
  preferred_name text CHECK (preferred_name IS NULL OR length(btrim(preferred_name)) BETWEEN 1 AND 80),
  date_of_birth  date CHECK (date_of_birth IS NULL OR date_of_birth BETWEEN DATE '1900-01-01' AND DATE '2100-01-01'),
  email          text CHECK (email IS NULL OR (length(email) <= 254 AND position('@' in email) > 1)),
  phone          text CHECK (phone IS NULL OR length(phone) BETWEEN 3 AND 32),
  archived_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);
CREATE INDEX people_org_name_idx ON people (org_id, lower(family_name), lower(given_name));

CREATE TABLE person_roles (
  org_id    uuid NOT NULL,
  person_id uuid NOT NULL,
  role      text NOT NULL CHECK (role IN ('camper', 'participant', 'guardian', 'instructor', 'organizer', 'admin_staff')),
  PRIMARY KEY (person_id, role),
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE
);
CREATE INDEX person_roles_org_role_idx ON person_roles (org_id, role);

CREATE TABLE households (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE TABLE household_members (
  org_id       uuid NOT NULL,
  household_id uuid NOT NULL,
  person_id    uuid NOT NULL,
  relationship text NOT NULL CHECK (length(btrim(relationship)) BETWEEN 1 AND 40),
  is_guardian  boolean NOT NULL DEFAULT false,
  can_pickup   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (household_id, person_id),
  FOREIGN KEY (org_id, household_id) REFERENCES households (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  CHECK (NOT can_pickup OR is_guardian)  -- only a guardian can be authorised to collect a child
);
CREATE INDEX household_members_person_idx ON household_members (org_id, person_id);

CREATE TABLE memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  person_id      uuid NOT NULL,
  plan           text NOT NULL CHECK (length(btrim(plan)) BETWEEN 1 AND 80),
  starts_on      date NOT NULL,
  ends_on        date NOT NULL,
  revoked_at     timestamptz,
  revoked_reason text CHECK (revoked_reason IS NULL OR length(btrim(revoked_reason)) BETWEEN 1 AND 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  CHECK (ends_on >= starts_on),
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
CREATE INDEX memberships_person_idx ON memberships (org_id, person_id, starts_on);

CREATE TABLE credentials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  person_id  uuid NOT NULL,
  -- SHA-256 of the badge token. The token itself is never stored.
  token_hash bytea NOT NULL CHECK (octet_length(token_hash) = 32),
  issued_at  timestamptz NOT NULL DEFAULT now(),
  issued_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  UNIQUE (token_hash)
);
-- At most one active badge per person.
CREATE UNIQUE INDEX credentials_one_active_idx ON credentials (person_id) WHERE revoked_at IS NULL;

CREATE TABLE check_ins (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL,
  person_id              uuid NOT NULL,
  checked_in_at          timestamptz NOT NULL,
  checked_in_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  method                 text NOT NULL CHECK (method IN ('qr', 'search', 'manual')),
  checked_out_at         timestamptz,
  checked_out_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  collected_by_person_id uuid,
  override_reason        text CHECK (override_reason IS NULL OR length(btrim(override_reason)) BETWEEN 1 AND 500),
  note                   text CHECK (note IS NULL OR length(note) <= 500),
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, collected_by_person_id) REFERENCES people (org_id, id) ON DELETE SET NULL (collected_by_person_id),
  CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at),
  CHECK (checked_out_at IS NOT NULL OR (checked_out_by IS NULL AND collected_by_person_id IS NULL))
);
-- At most one open check-in per person.
CREATE UNIQUE INDEX check_ins_one_open_idx ON check_ins (person_id) WHERE checked_out_at IS NULL;
CREATE INDEX check_ins_org_time_idx ON check_ins (org_id, checked_in_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people', 'person_roles', 'households', 'household_members', 'memberships', 'credentials', 'check_ins'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO buxa_app USING (org_id = current_org()) WITH CHECK (org_id = current_org())', t || '_tenant', t);
  END LOOP;
END $$;

-- Least privilege: nothing is ever hard-deleted by request code (people are archived, memberships revoked, badges revoked,
-- check-ins closed). Only link tables may delete rows.
GRANT SELECT, INSERT, UPDATE ON people, memberships, credentials, check_ins, households TO buxa_app;
GRANT SELECT, INSERT, DELETE ON person_roles TO buxa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON household_members TO buxa_app;
