-- 0070: delete a registration form that has no registrations. Staff with registration:manage (admin and owner) may delete it.
--
-- The request role has no DELETE on registration_forms, registration_form_versions or registration_form_sessions (0023), so the
-- delete is a function, the same shape as buxa_delete_registration_v1 (0054). It refuses when any registration names the form, in any
-- status, because registrations.(form_id, form_version) references the versions without a cascade. The check is also in the
-- service and in @buxa/domain (decideFormDeletion); this is the backstop inside the database.
--
-- A form that is deleted takes its versions, its covered sessions (registration_form_sessions) and its attachments
-- (registration_form_files) with it, by the existing ON DELETE CASCADE foreign keys. The audit row is written by the app in the same
-- transaction (registration_form.delete).

CREATE FUNCTION buxa_delete_registration_form_v1(p_org_id uuid, p_form_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to delete a registration form' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM registration_forms f WHERE f.id = p_form_id AND f.org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration form not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM registrations r WHERE r.org_id = p_org_id AND r.form_id = p_form_id) THEN
    RAISE EXCEPTION 'This form has registrations, so it cannot be deleted.'
      USING ERRCODE = '23503', CONSTRAINT = 'registration_form_has_registrations';
  END IF;
  DELETE FROM registration_forms WHERE id = p_form_id AND org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_registration_form_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_registration_form_v1(uuid, uuid) TO buxa_app;
