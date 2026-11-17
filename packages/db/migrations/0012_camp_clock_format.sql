-- The camp's clock: 12-hour (with AM/PM) or 24-hour times on every screen. It is a column on the camp's own row, next to
-- its time zone, so it is changed through the same admin path and audited the same way. The existing row-level security
-- policies and the table-level grants on orgs (0001) cover the new column, so nothing else changes.
ALTER TABLE orgs ADD COLUMN clock_format text NOT NULL DEFAULT '24h' CHECK (clock_format IN ('12h', '24h'));
