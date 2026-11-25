-- v0.4 class series: deleting one day (a row of sessions) must not lose a series' places.
--
-- buxa_delete_class_v2 (migration 0032) refused a delete only when an enrolment was anchored to that day (session_id). The
-- anchor foreign keys of seat_holds and registration_classes, and of enrolments on the anchor day, cascade on delete, so a
-- day that is the anchor of a hold or a registration was removed silently. A class is a series now (migration 0060), so the
-- rule is by series: a day is refused while its series has any enrolment, seat hold or registration row, cancelled or not.
-- The series delete (buxa_delete_series_v1, migration 0064) already applies the same rule.
--
-- Same signature and grants (CREATE OR REPLACE keeps them). The message is the existing one: "The class has enrolments".

CREATE OR REPLACE FUNCTION buxa_delete_class_v2(p_org_id uuid, p_class_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_series_id uuid;
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  SELECT series_id INTO v_series_id FROM sessions WHERE id = p_class_id AND org_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrolments WHERE org_id = p_org_id AND series_id = v_series_id)
     OR EXISTS (SELECT 1 FROM seat_holds WHERE org_id = p_org_id AND series_id = v_series_id)
     OR EXISTS (SELECT 1 FROM registration_classes WHERE org_id = p_org_id AND series_id = v_series_id) THEN
    RAISE EXCEPTION 'The class has enrolments' USING ERRCODE = '23503', CONSTRAINT = 'sessions_has_enrolments';
  END IF;
  DELETE FROM sessions WHERE id = p_class_id AND org_id = p_org_id;
END $$;
