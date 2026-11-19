-- Bulk import: a session can carry the spreadsheet's external_key, so a later file can find it and update it in place.
-- A key is unique within a camp (the partial index ignores sessions without one). The import plan checks this too; the index
-- is the backstop when two imports race.
ALTER TABLE sessions
  ADD COLUMN external_key text CHECK (external_key IS NULL OR length(external_key) BETWEEN 1 AND 100);

CREATE UNIQUE INDEX sessions_org_external_key_idx ON sessions (org_id, external_key) WHERE external_key IS NOT NULL;
