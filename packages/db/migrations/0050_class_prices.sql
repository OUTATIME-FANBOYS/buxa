-- Phase 4: a price belongs to a class (a row of `sessions`), not to a session (a row of `classes`). Each class carries its own
-- price and early-bird fields, so a family pays per class. Nothing is charged in this phase.
--
-- Three steps, in one transaction:
--   1. Add the price columns and their shape check to `sessions`, with the same checks 0024 put on `classes`.
--   2. Copy each session's price onto every class of that session, so no price is lost. A session with a price and no classes
--      has nowhere to copy it to; the notice below counts those.
--   3. Drop the price columns and their check from `classes`.
-- The copy only fills rows that have no price yet, so a class that already has its own price keeps it.

ALTER TABLE sessions
  ADD COLUMN price_minor integer CHECK (price_minor IS NULL OR price_minor BETWEEN 0 AND 99999999999),
  ADD COLUMN price_currency char(3) CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN early_bird_minor integer CHECK (early_bird_minor IS NULL OR early_bird_minor BETWEEN 0 AND 99999999999),
  ADD COLUMN early_bird_until date,
  ADD CONSTRAINT sessions_price_shape CHECK (
    (price_minor IS NULL AND price_currency IS NULL AND early_bird_minor IS NULL AND early_bird_until IS NULL)
    OR (
      price_minor IS NOT NULL AND price_currency IS NOT NULL
      AND ((early_bird_minor IS NULL) = (early_bird_until IS NULL))
      AND (early_bird_minor IS NULL OR early_bird_minor <= price_minor)
    )
  );

DO $$
DECLARE
  stranded integer;
BEGIN
  SELECT count(*)::integer INTO stranded
    FROM classes p
   WHERE p.price_minor IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.class_id = p.id);
  IF stranded > 0 THEN
    RAISE NOTICE 'migration 0050: % session price(s) have no classes to copy onto and are not carried over', stranded;
  END IF;
END $$;

UPDATE sessions s
   SET price_minor = p.price_minor,
       price_currency = p.price_currency,
       early_bird_minor = p.early_bird_minor,
       early_bird_until = p.early_bird_until
  FROM classes p
 WHERE p.id = s.class_id
   AND p.price_minor IS NOT NULL
   AND s.price_minor IS NULL;

-- drop-approved: phase 4 (the session price is no longer read or written; each class carries its own price from this release)
ALTER TABLE classes
  DROP CONSTRAINT classes_price_shape,
  DROP COLUMN price_minor,
  DROP COLUMN price_currency,
  DROP COLUMN early_bird_minor,
  DROP COLUMN early_bird_until;

-- The public session page lists each class with its own price. The 0029 function keeps its return type, so the code that is still
-- running against it keeps working; this is a new function that returns the price columns as well.
CREATE OR REPLACE FUNCTION buxa_public_classes_v2(p_slug text, p_session_id uuid, p_from timestamptz)
RETURNS TABLE (
  class_name text, age_min integer, age_max integer, location text, starts_at timestamptz, ends_at timestamptz,
  price_minor integer, price_currency text, early_bird_minor integer, early_bird_until text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.name, s.age_min, s.age_max, s.location, s.starts_at, s.ends_at,
         s.price_minor, s.price_currency::text, s.early_bird_minor, to_char(s.early_bird_until, 'YYYY-MM-DD')
    FROM sessions s
    JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
    JOIN orgs o ON o.id = p.org_id
   WHERE o.slug = p_slug AND o.archived_at IS NULL AND p.id = p_session_id AND p.is_public
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;

REVOKE ALL ON FUNCTION buxa_public_classes_v2(text, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_public_classes_v2(text, uuid, timestamptz) TO buxa_app;

-- Supabase's API roles must not reach it either (as in migration 0009).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_public_classes_v2(text, uuid, timestamptz) FROM %I', r);
    END IF;
  END LOOP;
END $$;
