-- Phase 2 follow-up: the two parts of a class and its sessions that 0008 did not store.
-- 1. A class's instructor ratio (stored, not enforced). Both numbers or neither.
-- 2. The instructors on a session. A session's ratio is copied from its class when the session is created, so it can be
--    NULL when the class has no ratio.

ALTER TABLE classes
  ADD COLUMN ratio_campers     integer CHECK (ratio_campers IS NULL OR ratio_campers BETWEEN 1 AND 500),
  ADD COLUMN ratio_instructors integer CHECK (ratio_instructors IS NULL OR ratio_instructors BETWEEN 1 AND 50),
  ADD CONSTRAINT classes_ratio_both CHECK ((ratio_campers IS NULL) = (ratio_instructors IS NULL));

ALTER TABLE sessions
  ALTER COLUMN ratio_campers DROP NOT NULL,
  ALTER COLUMN ratio_instructors DROP NOT NULL,
  ADD CONSTRAINT sessions_ratio_both CHECK ((ratio_campers IS NULL) = (ratio_instructors IS NULL));

CREATE TABLE session_instructors (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  person_id  uuid NOT NULL,
  PRIMARY KEY (session_id, person_id),
  FOREIGN KEY (org_id, session_id) REFERENCES sessions (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE
);
CREATE INDEX session_instructors_org_person_idx ON session_instructors (org_id, person_id);

ALTER TABLE session_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_instructors FORCE ROW LEVEL SECURITY;
CREATE POLICY session_instructors_tenant ON session_instructors FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- Least privilege, as for the other phase 2 tables: request code never hard-deletes an instructor assignment.
GRANT SELECT, INSERT ON session_instructors TO buxa_app;
