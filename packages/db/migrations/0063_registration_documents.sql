-- Registration: document questions. A family uploads a file for a document question (an immunization record, say) when a registration
-- is taken. The file's bytes are kept here, one row per question per registration; the registration's answer holds the file id and
-- its review (answers.custom.<key> = { "fileId", "status" }), so the answer and the file always name each other.
--
-- Review: a submitted document is "pending" until staff check it. Staff set it to pending, accepted or needs_replacing through
-- buxa_set_document_review_v1, which updates the file row and the answer in one statement. The request role cannot update either
-- table directly. A document question with no file shows "Not received" in the app; it is not stored.
--
-- Erasure: a registration's files are removed with it. registration_files cascades from registrations, so buxa_delete_registration_v1
-- (migration 0054) erases the bytes too, with no change to that function.
--
-- Additive only: a new table and a new function. Nothing existing is changed, so it runs on a database with data.

CREATE TABLE registration_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL,
  field_key     text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 255),
  content_type  text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
  bytes         bytea NOT NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'needs_replacing')),
  uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  CONSTRAINT registration_files_size_matches CHECK (octet_length(bytes) = size_bytes),
  CONSTRAINT registration_files_reviewed_together CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL)),
  UNIQUE (org_id, id),
  UNIQUE (org_id, registration_id, field_key),
  FOREIGN KEY (org_id, registration_id) REFERENCES registrations (org_id, id) ON DELETE CASCADE
);

ALTER TABLE registration_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_files FORCE ROW LEVEL SECURITY;

-- Members read the files of their camp (the document route checks the signed-in user's role). Staff and above may add one, since
-- a submission is taken by staff (registration:submit). The review columns are changed only by the function below.
CREATE POLICY registration_files_member_read ON registration_files FOR SELECT TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IS NOT NULL);
CREATE POLICY registration_files_staff_insert ON registration_files FOR INSERT TO buxa_app
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('staff', 'admin', 'owner'));

GRANT SELECT, INSERT ON registration_files TO buxa_app;

CREATE FUNCTION buxa_set_document_review_v1(p_org_id uuid, p_file_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  f registration_files%ROWTYPE;
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('staff', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to review a document' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'accepted', 'needs_replacing') THEN
    RAISE EXCEPTION 'Unknown document status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM registration_files WHERE id = p_file_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE registration_files
     SET review_status = p_status, reviewed_at = now(), reviewed_by = current_user_id()
   WHERE id = p_file_id AND org_id = p_org_id;
  -- The answer that names this file carries the same status. A registration whose answer names another file is left alone.
  UPDATE registrations
     SET answers = jsonb_set(answers, ARRAY['custom', f.field_key, 'status'], to_jsonb(p_status), false)
   WHERE id = f.registration_id AND org_id = p_org_id
     AND answers #>> ARRAY['custom', f.field_key, 'fileId'] = p_file_id::text;
END $$;

REVOKE ALL ON FUNCTION buxa_set_document_review_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_document_review_v1(uuid, uuid, text) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_set_document_review_v1(uuid, uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;
