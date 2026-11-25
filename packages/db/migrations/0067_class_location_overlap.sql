-- v0.4 class location rule (owner decision): classes may overlap in time, but two ACTIVE class days in the same location may not.
--
-- "Same location" is compared the way rooms are: buxa_name_key (migration 0056), which is case and spacing insensitive. The app
-- checks the rule first and gives a readable refusal (packages/domain/src/classes/location.ts); this file makes the rule hold
-- under concurrency. Two creates that race for the same place cannot both commit: the database refuses the second one.
--
-- 1. The key. location_key is the generated buxa_name_key(location), so the constraint compares the same form as the app.
-- 2. The constraint. An exclusion constraint on (org, location key) with the active day's half-open time range (&&). It needs
--    btree_gist for the equality on uuid and text inside a GiST index. btree_gist is a trusted extension (PostgreSQL 13 and later).
--    Cancelled days (sessions.status = 'cancelled') take no place and are left out, so a cancelled day can overlap anything.
--
-- Stop, changing nothing, when existing rows already break the rule: the file raises an error that lists each pair, and the whole
-- file rolls back. Fix those rows by hand, then run the migration again.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Stop when existing active days in one location overlap. Nothing is changed when this raises.
DO $$
DECLARE
  problems text;
BEGIN
  SELECT string_agg(
           format('  %s (%s to %s) and %s (%s to %s) in %s, camp %s',
                  a.name, a.starts_at, a.ends_at, b.name, b.starts_at, b.ends_at, a.location, a.org_id),
           E'\n' ORDER BY a.org_id, a.starts_at)
    INTO problems
    FROM sessions a
    JOIN sessions b
      ON b.org_id = a.org_id
     AND buxa_name_key(b.location) = buxa_name_key(a.location)
     AND b.id > a.id
     AND b.status = 'active'
   WHERE a.status = 'active'
     AND tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at);
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Class location migration 0066 stopped: two classes in the same location overlap in time. Nothing was changed. Move or cancel one of each pair by hand, then run again:\n%', problems;
  END IF;
END $$;

-- 2. The key and the rule.
ALTER TABLE sessions ADD COLUMN location_key text GENERATED ALWAYS AS (buxa_name_key(location)) STORED;

ALTER TABLE sessions ADD CONSTRAINT sessions_location_overlap
  EXCLUDE USING gist (
    org_id WITH =,
    location_key WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (status = 'active');
