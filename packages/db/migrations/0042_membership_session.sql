-- Memberships made from a session. A membership takes its dates and its name from a session of the camp; a custom membership has
-- no session and keeps the name typed in `plan`. The `plan` column is kept as it is: for a session membership it holds the
-- session's name.
--
-- A session is a row of `classes` (the parent, with its date range; see 0022), so session_id points there, not at `sessions`
-- (the time-range rows that hold a session's classes). The composite foreign key keeps the link inside the camp (the same
-- org_id), as every other link in the schema does. When a session is deleted, the membership stays and its session_id is cleared.
-- The existing row policy and grants on memberships (0007, 0009) cover the new column; nothing is granted or relaxed here.

ALTER TABLE memberships ADD COLUMN session_id uuid;

ALTER TABLE memberships
  ADD CONSTRAINT memberships_session_fk
  FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE SET NULL (session_id);

CREATE INDEX memberships_org_session_idx ON memberships (org_id, session_id) WHERE session_id IS NOT NULL;
