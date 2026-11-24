-- Registration forms: files attached to a form for families to download (a blank immunization form, say).
--
-- Storage: the app has no object storage today (Supabase is used for sign-in only, and no bucket or blob store is configured). A
-- second provider would be a new place for personal data, so the bytes are kept in this table, as bytea. The file is then under the
-- same row-level security, backups and deletion as every other camp row. Downloads go through an authorised route that checks the
-- form covers the session the family registers for (see RegistrationService.downloadFormFile); the bytes are never served by URL.
--
-- Least privilege: members read; only an admin or the owner adds or removes an attachment (the registration:manage rule). The
-- size and type are checked again here, so a row the app would refuse cannot be written by another path.
-- Additive only: a new table, nothing existing is changed, so it runs on a database with data.

CREATE TABLE registration_form_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  form_id      uuid NOT NULL,
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 255),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes   integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
  bytes        bytea NOT NULL,
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_form_files_size_matches CHECK (octet_length(bytes) = size_bytes),
  FOREIGN KEY (org_id, form_id) REFERENCES registration_forms (org_id, id) ON DELETE CASCADE
);
CREATE INDEX registration_form_files_org_form_idx ON registration_form_files (org_id, form_id);

ALTER TABLE registration_form_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_form_files FORCE ROW LEVEL SECURITY;

-- Any current member of the camp may read (the download route checks the form and the session).
CREATE POLICY registration_form_files_member_read ON registration_form_files FOR SELECT TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IS NOT NULL);
-- Only an admin or the owner may add or remove one.
CREATE POLICY registration_form_files_admin_insert ON registration_form_files FOR INSERT TO buxa_app
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));
CREATE POLICY registration_form_files_admin_delete ON registration_form_files FOR DELETE TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));

GRANT SELECT, INSERT, DELETE ON registration_form_files TO buxa_app;
