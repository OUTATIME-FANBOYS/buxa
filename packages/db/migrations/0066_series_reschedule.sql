-- v0.4 class series: an edit of a series' days (the New class form, saved as an edit) can remove a day that no one is on.
--
-- Request code has no DELETE grant on sessions (its days), so the removal runs here, as the owner, like buxa_delete_series_v1
-- (migration 0064). The function refuses the whole removal while the series has any place: an enrolment that is not cancelled, a
-- seat hold that is not released or expired, or a registration that is not withdrawn. Its message is the existing one, "The class
-- has enrolments", and nothing is deleted. The application checks the same rule first and names the children (ClassService).
--
-- The weekdays and the first and last allowed times of the series, and the days added, are written by request code in the same
-- transaction (see PgSeriesWrites.updateSeriesRow). Same signature style and grants as buxa_delete_series_v1.

CREATE FUNCTION buxa_delete_occurrences_v1(p_org_id uuid, p_series_id uuid, p_occurrence_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to manage classes' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM class_series WHERE id = p_series_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrolments WHERE series_id = p_series_id AND org_id = p_org_id AND status <> 'cancelled')
     OR EXISTS (SELECT 1 FROM seat_holds WHERE series_id = p_series_id AND org_id = p_org_id
                  AND released_at IS NULL AND expires_at > now())
     OR EXISTS (SELECT 1 FROM registration_classes rc
                  JOIN registrations r ON r.id = rc.registration_id AND r.org_id = rc.org_id
                 WHERE rc.series_id = p_series_id AND rc.org_id = p_org_id AND r.status <> 'withdrawn') THEN
    RAISE EXCEPTION 'The class has enrolments' USING ERRCODE = '23503', CONSTRAINT = 'sessions_has_enrolments';
  END IF;
  DELETE FROM sessions WHERE id = ANY (p_occurrence_ids) AND series_id = p_series_id AND org_id = p_org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_delete_occurrences_v1(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_occurrences_v1(uuid, uuid, uuid[]) TO buxa_app;
