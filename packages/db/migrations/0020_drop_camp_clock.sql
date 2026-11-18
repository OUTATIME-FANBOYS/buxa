-- The camp-level clock is gone.

-- Every displayed time follows the signed-in person's own 12 or 24 hour choice (users.clock_format, migration 0018), and
-- 24 hour when they have not chosen one. Nothing reads orgs.clock_format any more, so the column is removed.
ALTER TABLE orgs DROP COLUMN clock_format;
