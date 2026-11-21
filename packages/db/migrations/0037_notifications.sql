-- Notifications: one row per recipient. The rows are written in the same transaction as the event that causes them (see
-- apps/server/src/notifications), and each recipient is chosen by permission (who may see the kind of event), not by the UI.
-- A user reads only their own rows, and can only mark them read: the app role has no DELETE, and UPDATE is granted for
-- read_at alone.

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('registration', 'schedule', 'people')),
  title      text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  link       text NOT NULL CHECK (link LIKE '/camp/%' AND length(link) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE
);
CREATE INDEX notifications_user_idx ON notifications (org_id, user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- Written by the event's own transaction, for any recipient in the camp.
CREATE POLICY notifications_insert ON notifications FOR INSERT TO buxa_app
  WITH CHECK (org_id = current_org());
-- Read and marked read by their recipient only.
CREATE POLICY notifications_own_select ON notifications FOR SELECT TO buxa_app
  USING (org_id = current_org() AND user_id = current_user_id());
CREATE POLICY notifications_own_update ON notifications FOR UPDATE TO buxa_app
  USING (org_id = current_org() AND user_id = current_user_id())
  WITH CHECK (org_id = current_org() AND user_id = current_user_id());

GRANT SELECT, INSERT ON notifications TO buxa_app;
GRANT UPDATE (read_at) ON notifications TO buxa_app;
