-- Phase 3: seat holds. A hold reserves one place in a session (the table `sessions`, called a Class in the app) for a household
-- while it completes registration. It expires on its own: a hold counts as taken only while it is unreleased AND not yet expired,
-- so an expired hold returns its place the moment its time passes, with no job needed. The app releases expired rows later
-- (a cleanup that is safe to run twice); that only tidies the table and promotes the waitlist.
--
-- Same rules as 0008: org_id on every row, forced row-level security, composite foreign keys, no hard deletes for the request role.
-- Expand only: enrolments, capacity triggers and the seat count gain holds. Nothing is dropped; functions are replaced in place.

CREATE TABLE seat_holds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL,
  household_id   uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Set by the app (camp settings decide the length). Not checked against created_at: a cleanup test may write a past expiry.
  expires_at     timestamptz NOT NULL,
  released_at    timestamptz,
  -- 'cancelled': released by the family or staff before expiry. 'expired': released by the cleanup after expires_at passed.
  release_reason text CHECK (release_reason IN ('cancelled', 'expired')),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, session_id) REFERENCES sessions (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, household_id) REFERENCES households (org_id, id) ON DELETE CASCADE,
  CHECK ((released_at IS NULL) = (release_reason IS NULL))
);
-- A household holds at most one place per session at a time. An expired but unreleased hold is swept by the app before a new
-- hold is taken, so it does not block the family.
CREATE UNIQUE INDEX seat_holds_one_active_idx ON seat_holds (session_id, household_id) WHERE released_at IS NULL;
CREATE INDEX seat_holds_org_session_idx ON seat_holds (org_id, session_id) WHERE released_at IS NULL;

-- The seats a session has taken right now: enrolled campers plus holds that are unreleased and not yet expired. `now()` is the
-- start of the calling transaction, so every check in one transaction agrees, and a hold never counts after its time has passed.
CREATE FUNCTION session_seats_taken(p_session_id uuid) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT ((SELECT count(*) FROM enrolments e WHERE e.session_id = p_session_id AND e.status = 'enrolled')
        + (SELECT count(*) FROM seat_holds h
            WHERE h.session_id = p_session_id AND h.released_at IS NULL AND h.expires_at > now()))::integer
$$;

-- Enrolment capacity (replaces the count in 0008 with the one above). Same lock, same error name.
CREATE OR REPLACE FUNCTION enrolments_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  IF NEW.status <> 'enrolled' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'enrolled' AND OLD.session_id = NEW.session_id THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM sessions WHERE id = NEW.session_id FOR UPDATE;
  -- BEFORE trigger: the incoming row is not counted yet, so it is added here.
  taken := session_seats_taken(NEW.session_id);
  IF taken + 1 > cap THEN
    RAISE EXCEPTION 'session is full' USING ERRCODE = 'check_violation', CONSTRAINT = 'enrolments_capacity';
  END IF;
  RETURN NEW;
END $$;

-- A hold takes a place under the same session lock, so holds and enrolments for the last place are serialised.
CREATE FUNCTION seat_holds_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  SELECT capacity INTO cap FROM sessions WHERE id = NEW.session_id FOR UPDATE;
  taken := session_seats_taken(NEW.session_id);
  IF taken + 1 > cap THEN
    RAISE EXCEPTION 'session is full' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_capacity';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER seat_holds_capacity BEFORE INSERT ON seat_holds
  FOR EACH ROW EXECUTE FUNCTION seat_holds_enforce_capacity();

-- Lowering a session's capacity below the places taken (enrolled or held) is refused. Replaces the function in 0008.
CREATE OR REPLACE FUNCTION sessions_enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  taken integer;
BEGIN
  IF NEW.capacity >= OLD.capacity THEN RETURN NEW; END IF;
  taken := session_seats_taken(NEW.id);
  IF taken > NEW.capacity THEN
    RAISE EXCEPTION 'capacity % is below the % places already taken', NEW.capacity, taken
      USING ERRCODE = 'check_violation', CONSTRAINT = 'sessions_capacity_floor';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE seat_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_holds FORCE ROW LEVEL SECURITY;
CREATE POLICY seat_holds_tenant ON seat_holds FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- Least privilege, as for enrolments: a hold is released (released_at set), never deleted by request code.
GRANT SELECT, INSERT, UPDATE ON seat_holds TO buxa_app;
