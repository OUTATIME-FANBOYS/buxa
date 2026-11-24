-- Phase 4: a session's dates can be shortened without deadlock. A class (a row of `sessions`) whose time range falls outside its
-- session's new dates is flagged, and keeps its times. The flag is `dates_outside_session`; the app keeps it in step with the dates
-- on every session save and class save, in the same transaction (see packages/domain/src/classes/sessionDateFlags.ts).
--
-- Expand only for the existing data: the column defaults to false, so every class keeps its current state. The table grants on
-- sessions (0008) cover the new column, so nothing is granted here.

ALTER TABLE sessions
  ADD COLUMN dates_outside_session boolean NOT NULL DEFAULT false;

-- 1. The widen trigger (0022) stays as it is, and it is replaced only in its function body. A flagged class never widens its
--    session: the session's dates are the owner's to set, and a flagged class is fixed by hand. A class inside its session's
--    dates is a no-op here, as before.
CREATE OR REPLACE FUNCTION sessions_widen_session_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tz text;
  first_day date;
  last_day date;
BEGIN
  IF NEW.dates_outside_session THEN
    RETURN NEW;
  END IF;
  SELECT o.timezone INTO tz FROM orgs o WHERE o.id = NEW.org_id;
  first_day := (NEW.starts_at AT TIME ZONE tz)::date;
  last_day := (NEW.ends_at AT TIME ZONE tz)::date;
  UPDATE classes c
     SET starts_on = LEAST(COALESCE(c.starts_on, first_day), first_day),
         ends_on = GREATEST(COALESCE(c.ends_on, last_day), last_day)
   WHERE c.id = NEW.class_id AND c.org_id = NEW.org_id;
  RETURN NEW;
END $$;

-- 2. The public class list (the function the public page reads, 0053) does not list a flagged class.
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
     AND p.status = 'live' AND p.archived_at IS NULL
     AND NOT s.dates_outside_session
     AND s.ends_at >= p_from
   ORDER BY s.starts_at, s.id;
$$;
