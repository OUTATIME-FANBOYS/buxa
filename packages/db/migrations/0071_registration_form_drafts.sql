-- 0071: the whole form is a draft until it is published (owner decision, v0.4).
--
-- Until now only the questions (draft_fields) waited for publish. Saving a draft wrote the name, the season and the session set
-- straight to the live row, so families saw them at once. From here, every edit is a draft: draft_name, draft_season,
-- draft_session_ids and draft_fields. Saving a draft writes those only. Publishing copies them into the live columns
-- (registration_forms.name, season and registration_form_sessions) and into the new immutable version row, in one transaction.
-- The live columns are therefore the published version, and families register on the published version only.
--
-- Backfill. Every existing form gets its draft from its live values: the name and season from the row, and the session set from
-- registration_form_sessions. Those are the values the form has now, so they are the right drafts. The draft columns are then made
-- NOT NULL, which is safe because every row has a name and a (possibly empty) session array after the backfill.
--
-- Versions. registration_form_versions gains the name, season and session ids each version was published with, so the history
-- shows what families registered on. Versions published before this migration have no record of them: the columns stay NULL for
-- those rows (they are not guessed from the live row, which may hold edits made before this change). Readers fall back to the
-- live values for a NULL snapshot (see buxa_form_published_session_ids below). No version row is rewritten.

ALTER TABLE registration_forms
  ADD COLUMN draft_name        text,
  ADD COLUMN draft_season      text,
  ADD COLUMN draft_session_ids uuid[];

UPDATE registration_forms f
   SET draft_name        = f.name,
       draft_season      = f.season,
       draft_session_ids = ARRAY(SELECT s.session_id FROM registration_form_sessions s WHERE s.form_id = f.id);

-- Backfill check: every form now has a draft. Stops with the list if not, rather than making a column NOT NULL over gaps.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('form %s (camp %s)', f.id, f.org_id), E'\n  ' ORDER BY f.id)
    INTO missing
    FROM registration_forms f
   WHERE f.draft_name IS NULL OR f.draft_session_ids IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0071 could not copy the draft of these registration forms; nothing was changed:%', E'\n  ' || missing
      USING ERRCODE = '23502';
  END IF;
END $$;

ALTER TABLE registration_forms
  ALTER COLUMN draft_name SET NOT NULL,
  ALTER COLUMN draft_session_ids SET NOT NULL,
  ALTER COLUMN draft_session_ids SET DEFAULT '{}',
  ADD CONSTRAINT registration_forms_draft_name_length CHECK (length(btrim(draft_name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT registration_forms_draft_season_length CHECK (draft_season IS NULL OR length(btrim(draft_season)) BETWEEN 1 AND 60);

-- The version snapshot. NULL for versions published before this migration; both columns are NULL together, and a published
-- snapshot names at least one session.
ALTER TABLE registration_form_versions
  ADD COLUMN name        text,
  ADD COLUMN season      text,
  ADD COLUMN session_ids uuid[],
  ADD CONSTRAINT registration_form_versions_name_length CHECK (name IS NULL OR length(btrim(name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT registration_form_versions_season_length CHECK (season IS NULL OR length(btrim(season)) BETWEEN 1 AND 60),
  ADD CONSTRAINT registration_form_versions_snapshot_pair CHECK ((name IS NULL) = (session_ids IS NULL)),
  ADD CONSTRAINT registration_form_versions_sessions_present CHECK (session_ids IS NULL OR cardinality(session_ids) > 0);

-- The session set families register on: the published version's session ids. A version published before this migration has no
-- snapshot, so its live rows stand in (the live rows are the published set until the next publish, which is how it was). A form
-- that was never published has no published set, so it reads as empty, whatever its live rows hold.
CREATE FUNCTION buxa_form_published_session_ids(p_org_id uuid, p_form_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SET search_path = pg_catalog, public
AS $$
  SELECT CASE
           WHEN f.published_version IS NULL THEN '{}'::uuid[]
           ELSE COALESCE(
                  v.session_ids,
                  ARRAY(SELECT s.session_id FROM registration_form_sessions s WHERE s.org_id = f.org_id AND s.form_id = f.id)
                )
         END
    FROM registration_forms f
    LEFT JOIN registration_form_versions v
      ON v.org_id = f.org_id AND v.form_id = f.id AND v.version = f.published_version
   WHERE f.org_id = p_org_id AND f.id = p_form_id
$$;

REVOKE ALL ON FUNCTION buxa_form_published_session_ids(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_form_published_session_ids(uuid, uuid) TO buxa_app;
