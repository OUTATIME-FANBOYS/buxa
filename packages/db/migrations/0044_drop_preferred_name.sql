-- Remove the preferred name. A person is shown by first name and family name only, so the stored values go first and the
-- column (with its length check) is dropped after them.
-- drop-approved: v0.3.2

UPDATE people SET preferred_name = NULL WHERE preferred_name IS NOT NULL;

ALTER TABLE people DROP COLUMN preferred_name;
