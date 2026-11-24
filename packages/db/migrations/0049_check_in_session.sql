-- Phase 4: per-session check-in. A check-in can name the session (a row of `classes`, the parent the app calls a Session) that
-- the camper attends, and records whether the camper had no active place in that session when they arrived.
--
-- Expand only: both columns are new. Existing check-ins keep session_id NULL ("camp day only") and session_unassigned false.
-- The row policy and the table grants on check_ins (0007, 0009) cover the new columns, so nothing is granted or relaxed here.
-- The composite foreign key keeps the link inside the camp, as memberships.session_id does (0042). Deleting a session clears
-- the link and keeps the visit.

ALTER TABLE check_ins
  ADD COLUMN session_id uuid,
  ADD COLUMN session_unassigned boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT check_ins_session_fk
    FOREIGN KEY (org_id, session_id) REFERENCES classes (org_id, id) ON DELETE SET NULL (session_id);

CREATE INDEX check_ins_org_session_idx ON check_ins (org_id, session_id) WHERE session_id IS NOT NULL;
