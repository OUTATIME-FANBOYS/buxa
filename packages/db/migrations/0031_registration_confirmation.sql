-- Phase 3: registration confirmation (decision 3 in docs/phases/03-registration.md). A registration is recorded as pending and a
-- staff member confirms it as a separate action, which is audited (registration.confirm).
--
-- Registrations recorded before this migration were confirmed on entry, so they are backfilled as confirmed. Their answers stay
-- append-only: the request role gets UPDATE on the three confirmation columns only.

ALTER TABLE registrations
  ADD COLUMN status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT registrations_confirmation_check CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL));

UPDATE registrations SET status = 'confirmed', confirmed_at = created_at;

GRANT UPDATE (status, confirmed_at, confirmed_by) ON registrations TO buxa_app;
