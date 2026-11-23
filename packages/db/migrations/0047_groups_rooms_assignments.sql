-- Phase 4: groups, rooms and assignments (docs/phases/04-seats-rosters.md).
-- A group and a room belong to one session. The app's Session is the `classes` table (a date range, see migration 0022), so every
-- foreign key below points there: a group's capacity, age range and ratio, a room's capacity, the camp days a room is booked for,
-- and the overlap of two sessions all read that row.
--
-- An assignment places one person (a camper or a staff member) in one group and one room for one session. Only one active
-- assignment per person per session is allowed, in the database. Rules that read more than one row (capacity, age, ratio, room
-- overlap) run in the repository under locks, using the domain rules in packages/domain (see PgAssign.ts).
--
-- Same rules as the earlier tables: org_id on every row, forced row-level security with one policy, composite foreign keys so a
-- link can never point at another camp or at another session, and no hard delete for the request role. Expand only.

CREATE TABLE groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL,
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- Campers the group holds. Staff do not count toward it.
  capacity        integer NOT NULL CHECK (capacity > 0),
  -- Campers per staff member (1:8 is 8). NULL means the group has no ratio.
  ratio_campers   integer CHECK (ratio_campers IS NULL OR ratio_campers > 0),
  -- An optional age range, inclusive on both ends, taken on the session's first day. NULL means no range.
  age_min         integer CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 120),
  age_max         integer CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 120),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, id, session_id),
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);
CREATE UNIQUE INDEX groups_session_name_idx ON groups (session_id, lower(name));
CREATE INDEX groups_org_session_idx ON groups (org_id, session_id);

CREATE TABLE rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  -- The session this room is booked for. The same physical room (same name and location) is booked once per session it is used in;
  -- the placement lock joins those bookings, so two sessions that share a day cannot both use it.
  session_id      uuid NOT NULL,
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  location        text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 120),
  -- Campers the room holds for this session.
  capacity        integer NOT NULL CHECK (capacity > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, id, session_id),
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX rooms_session_name_idx ON rooms (session_id, lower(name));
CREATE INDEX rooms_org_session_idx ON rooms (org_id, session_id);

CREATE TABLE assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id            uuid NOT NULL,
  person_id             uuid NOT NULL,
  role                  text NOT NULL CHECK (role IN ('camper', 'staff')),
  group_id              uuid NOT NULL,
  room_id               uuid NOT NULL,
  active                boolean NOT NULL DEFAULT true,
  -- An admin's ratio override, with its reason. NULL when none. The change itself is also in the audit log.
  ratio_override_reason text CHECK (ratio_override_reason IS NULL OR length(btrim(ratio_override_reason)) BETWEEN 1 AND 500),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  -- The group and the room must belong to the same session as the assignment.
  FOREIGN KEY (org_id, group_id, session_id) REFERENCES groups (org_id, id, session_id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, room_id, session_id) REFERENCES rooms (org_id, id, session_id) ON DELETE CASCADE
);
-- One active assignment per person per session. A second active row for the same pair is refused by the database.
CREATE UNIQUE INDEX assignments_one_active_per_session_idx ON assignments (session_id, person_id) WHERE active;
CREATE INDEX assignments_group_idx ON assignments (org_id, group_id) WHERE active;
CREATE INDEX assignments_room_idx ON assignments (org_id, room_id) WHERE active;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['groups', 'rooms', 'assignments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO buxa_app USING (org_id = current_org()) WITH CHECK (org_id = current_org())', t || '_tenant', t);
  END LOOP;
END $$;

-- Least privilege: nothing is hard-deleted by request code. A move updates the assignment row; releasing a place is a later step.
GRANT SELECT, INSERT, UPDATE ON groups, rooms, assignments TO buxa_app;
