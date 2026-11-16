-- Phase 2: classes, sessions and enrolments.
-- Same rules as phase 1: org_id on every row, forced row-level security, composite (org_id, id) foreign keys so a link
-- can never point at another organisation, and no hard deletes for the request role.
--
-- Domain rules that need more than one row (overlap across all classes, age range, the waitlist decision) live in the
-- repository, which runs them under row locks (see PgClassRepository). The database enforces what it can on its own:
-- capacity as a hard limit (trigger below, serialised on the session row), one active enrolment per person per session,
-- and the shape of every value.

CREATE TABLE classes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description      text CHECK (description IS NULL OR length(description) <= 2000),
  -- Open-ended ranges are allowed (NULL). Both bounds are inclusive when set.
  age_min          integer CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 120),
  age_max          integer CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 120),
  default_capacity integer NOT NULL CHECK (default_capacity > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);
CREATE INDEX classes_org_name_idx ON classes (org_id, lower(name));

CREATE TABLE sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id         uuid NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  location         text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 120),
  capacity         integer NOT NULL CHECK (capacity > 0),
  -- Instructor ratio, stored only (not enforced yet). 1:8 is ratio_instructors = 1, ratio_campers = 8.
  ratio_campers     integer NOT NULL CHECK (ratio_campers > 0),
  ratio_instructors integer NOT NULL CHECK (ratio_instructors > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at)
);
CREATE INDEX sessions_org_class_idx ON sessions (org_id, class_id, starts_at);
CREATE INDEX sessions_org_time_idx ON sessions (org_id, starts_at, ends_at);

CREATE TABLE enrolments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL,
  person_id       uuid NOT NULL,
  status          text NOT NULL CHECK (status IN ('enrolled', 'waitlisted', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at    timestamptz,
  -- An admin override of the overlap rule. Recorded with its reason; the reason is mandatory when overridden.
  overridden      boolean NOT NULL DEFAULT false,
  override_reason text CHECK (override_reason IS NULL OR length(btrim(override_reason)) BETWEEN 1 AND 500),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, session_id) REFERENCES sessions (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CHECK (NOT overridden OR override_reason IS NOT NULL)
);
-- At most one active enrolment per person per session. A cancelled row does not block a new one.
CREATE UNIQUE INDEX enrolments_one_active_idx ON enrolments (session_id, person_id) WHERE status IN ('enrolled', 'waitlisted');
CREATE INDEX enrolments_org_person_idx ON enrolments (org_id, person_id, status);
CREATE INDEX enrolments_org_session_idx ON enrolments (org_id, session_id, status);

-- Capacity is a hard limit. The trigger locks the session row, so two concurrent enrolments for the last place are
-- serialised here even if the repository forgot to lock. It counts with a fresh statement after the lock, so under
-- READ COMMITTED it sees the other transaction's committed row.
CREATE FUNCTION enrolments_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  IF NEW.status <> 'enrolled' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'enrolled' AND OLD.session_id = NEW.session_id THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM sessions WHERE id = NEW.session_id FOR UPDATE;
  -- BEFORE trigger: the incoming row is not counted yet, so it is added here.
  SELECT count(*) INTO taken FROM enrolments WHERE session_id = NEW.session_id AND status = 'enrolled';
  IF taken + 1 > cap THEN
    RAISE EXCEPTION 'session is full' USING ERRCODE = 'check_violation', CONSTRAINT = 'enrolments_capacity';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enrolments_capacity BEFORE INSERT OR UPDATE OF status, session_id ON enrolments
  FOR EACH ROW EXECUTE FUNCTION enrolments_enforce_capacity();

-- Lowering a session's capacity below the number already enrolled is refused.
CREATE FUNCTION sessions_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  taken integer;
BEGIN
  IF NEW.capacity >= OLD.capacity THEN RETURN NEW; END IF;
  SELECT count(*) INTO taken FROM enrolments WHERE session_id = NEW.id AND status = 'enrolled';
  IF taken > NEW.capacity THEN
    RAISE EXCEPTION 'capacity % is below the % places already enrolled', NEW.capacity, taken
      USING ERRCODE = 'check_violation', CONSTRAINT = 'sessions_capacity_floor';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sessions_capacity_floor BEFORE UPDATE OF capacity ON sessions
  FOR EACH ROW EXECUTE FUNCTION sessions_enforce_capacity();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'sessions', 'enrolments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO buxa_app USING (org_id = current_org()) WITH CHECK (org_id = current_org())', t || '_tenant', t);
  END LOOP;
END $$;

-- Least privilege: nothing is hard-deleted by request code. An enrolment is cancelled (cancelled_at set), which frees
-- its place and its time.
GRANT SELECT, INSERT, UPDATE ON classes, sessions, enrolments TO buxa_app;
