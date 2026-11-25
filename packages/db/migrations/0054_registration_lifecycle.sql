-- Registration lifecycle (owner decision, docs/phases/03-registration.md "Registration lifecycle"). A registration can be
-- withdrawn (holds released, enrolments cancelled, the record kept), archived (hidden from lists, kept) or deleted (erased with all
-- its answers, by an admin or the owner).
--
-- Written to run safely on a database that already holds registrations:
-- 1. Four nullable columns are added (archived_at, archived_by, withdrawn_at, withdrawn_by), so every existing registration is
--    unarchived and not withdrawn.
-- 2. The status check gains 'withdrawn', and the confirmation check no longer requires confirmed_at to be empty after a
--    withdrawal (a confirmed registration that is withdrawn keeps the time it was confirmed). Both are only relaxed, so every
--    existing row still satisfies them. The old checks are found by what they say, not by an assumed generated name, because
--    production's history is not confirmed.
-- 3. The request role may update the new columns (and status, as before). It still has no DELETE.
-- 4. buxa_delete_registration_v1 erases a registration, its answers and its places (registration_classes and
--    registration_sessions cascade from it) for an admin or the owner. It refuses a registration whose places still hold an active
--    enrolment or an unreleased seat hold (the app releases or cancels those first, through the existing paths).
--
-- registration_sessions is no longer written by the app from this release. The table stays (expand only); dropping it is a later
-- migration, after one release has run without reading it.

ALTER TABLE registrations
  ADD COLUMN archived_at  timestamptz,
  ADD COLUMN archived_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN withdrawn_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- drop-approved: phase 4 (the two checks on status are replaced by looser ones in this file; no release reads a check by name)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'registrations'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE registrations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE registrations
  ADD CONSTRAINT registrations_status_check CHECK (status IN ('pending', 'confirmed', 'withdrawn')),
  ADD CONSTRAINT registrations_confirmation_check CHECK (
    CASE status
      WHEN 'confirmed' THEN confirmed_at IS NOT NULL
      WHEN 'pending' THEN confirmed_at IS NULL
      ELSE true
    END
    AND ((status = 'withdrawn') = (withdrawn_at IS NOT NULL))
  );

CREATE INDEX registrations_org_form_unarchived_idx ON registrations (org_id, form_id) WHERE archived_at IS NULL;

GRANT UPDATE (archived_at, archived_by, withdrawn_at, withdrawn_by) ON registrations TO buxa_app;

CREATE FUNCTION buxa_delete_registration_v1(p_org_id uuid, p_registration_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to delete a registration' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM registrations r WHERE r.id = p_registration_id AND r.org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
       SELECT 1 FROM registration_classes rc
         LEFT JOIN enrolments e ON e.org_id = rc.org_id AND e.id = rc.enrolment_id
         LEFT JOIN seat_holds h ON h.org_id = rc.org_id AND h.id = rc.hold_id
        WHERE rc.org_id = p_org_id AND rc.registration_id = p_registration_id
          AND ((e.id IS NOT NULL AND e.status <> 'cancelled') OR (h.id IS NOT NULL AND h.released_at IS NULL))
     )
  THEN
    RAISE EXCEPTION 'This registration still has enrolments or holds, withdraw it first'
      USING ERRCODE = '23503', CONSTRAINT = 'registration_has_enrolments';
  END IF;
  -- The answers are blanked first, then the row goes. The places (registration_classes) and the old session rows
  -- (registration_sessions) cascade from it.
  UPDATE registrations SET answers = '{}'::jsonb WHERE id = p_registration_id AND org_id = p_org_id;
  DELETE FROM registrations WHERE id = p_registration_id AND org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_registration_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_registration_v1(uuid, uuid) TO buxa_app;
