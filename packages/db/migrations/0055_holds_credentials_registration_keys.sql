-- Database integrity, part 1: seat holds per child, terminal holds and badges, registration keys, price snapshot.
--
-- Written to run on a database that already holds data. Where a new unique index or foreign key could fail on rows that are
-- already there, the migration checks first and stops with a message that lists the offending rows. It never changes or deletes
-- data to make a constraint fit (the one exception is the backfill of seat_holds.person_id, which only fills a new empty column).
--
-- 1. seat_holds.person_id. A hold is for one child. Two siblings of one household can each hold a place in the same class, and
--    one child cannot hold the same class twice. Nullable, because a hold released before this migration may name no child (a
--    hold is backfilled from the registration place that references it; others stay null). New holds must name a child: the
--    check below is NOT VALID, so it applies to rows written from now on and leaves the old rows alone.
-- 2. seat_holds is terminal once released, and its place cannot be moved: a guard trigger, plus UPDATE for the request role on the
--    two release columns only. (Class capacity edits are on `sessions`, a different table, and are not affected.)
-- 3. credentials: a revoked badge is permanently dead. A guard trigger (revoked_at cannot be cleared; a revoked badge holds no
--    sealed token) and UPDATE for the request role on the revoke columns only.
-- 4. registration_classes: one registration place per enrolment and per hold, and a price snapshot taken at submission.
-- 5. registration_forms.published_version points at a real version.

-- 1. Holds per child ---------------------------------------------------------------------------------------------------------
ALTER TABLE seat_holds ADD COLUMN person_id uuid;
ALTER TABLE seat_holds
  ADD CONSTRAINT seat_holds_person_fk FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE;

UPDATE seat_holds h
   SET person_id = rc.person_id
  FROM registration_classes rc
 WHERE rc.org_id = h.org_id AND rc.hold_id = h.id AND h.person_id IS NULL;

-- Two active holds for the same child and class would stop the new index. They cannot exist today (a household held a class once
-- and a child used one household), but the check is cheap and says exactly which rows to release.
DO $$
DECLARE
  found text;
BEGIN
  SELECT string_agg(format('class %s, child %s: holds %s', d.session_id, d.person_id, d.ids), E'\n  ' ORDER BY d.session_id, d.person_id)
    INTO found
    FROM (
      SELECT session_id, person_id, string_agg(id::text, ', ' ORDER BY created_at, id) AS ids
        FROM seat_holds
       WHERE released_at IS NULL AND person_id IS NOT NULL
       GROUP BY session_id, person_id
      HAVING count(*) > 1
    ) d;
  IF found IS NOT NULL THEN
    RAISE EXCEPTION E'A child holds the same class more than once, so the per-child hold index was not added. Release the extra holds and run again.\n  %', found
      USING ERRCODE = '23505', CONSTRAINT = 'seat_holds_one_active_person_idx';
  END IF;
END $$;

-- drop-approved: phase 4 (a hold is per child now; the code that runs after this release writes person_id and no longer relies on the household index)
DROP INDEX seat_holds_one_active_idx;
CREATE UNIQUE INDEX seat_holds_one_active_person_idx ON seat_holds (session_id, person_id) WHERE released_at IS NULL;
CREATE INDEX seat_holds_org_person_idx ON seat_holds (org_id, person_id) WHERE person_id IS NOT NULL;

-- A new hold names its child. Rows that exist already are not checked (NOT VALID), and releasing an old hold still passes.
ALTER TABLE seat_holds
  ADD CONSTRAINT seat_holds_person_named CHECK (person_id IS NOT NULL OR released_at IS NOT NULL) NOT VALID;

-- 2. A released hold is final ------------------------------------------------------------------------------------------------
CREATE FUNCTION seat_holds_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.released_at IS NOT NULL
     AND (NEW.released_at IS DISTINCT FROM OLD.released_at OR NEW.release_reason IS DISTINCT FROM OLD.release_reason) THEN
    RAISE EXCEPTION 'a released hold cannot be changed' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_released_final';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'a hold keeps its class, household, child and expiry' USING ERRCODE = 'check_violation', CONSTRAINT = 'seat_holds_place_fixed';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER seat_holds_guard BEFORE UPDATE ON seat_holds
  FOR EACH ROW EXECUTE FUNCTION seat_holds_guard();

REVOKE UPDATE ON seat_holds FROM buxa_app;
GRANT UPDATE (released_at, release_reason) ON seat_holds TO buxa_app;

-- 3. A revoked badge stays revoked -------------------------------------------------------------------------------------------
CREATE FUNCTION credentials_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
    RAISE EXCEPTION 'a badge keeps its person and token' USING ERRCODE = 'check_violation', CONSTRAINT = 'credentials_identity_fixed';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'a revoked badge cannot be reactivated' USING ERRCODE = 'check_violation', CONSTRAINT = 'credentials_revoked_final';
  END IF;
  IF NEW.revoked_at IS NOT NULL
     AND (NEW.token_ciphertext IS NOT NULL OR NEW.token_iv IS NOT NULL OR NEW.token_auth_tag IS NOT NULL) THEN
    RAISE EXCEPTION 'a revoked badge holds no sealed token' USING ERRCODE = 'check_violation', CONSTRAINT = 'credentials_revoked_wiped';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER credentials_guard BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION credentials_guard();

-- The app revokes a badge (revoked_at) and wipes the three sealed columns in the same statement, and writes nothing else.
REVOKE UPDATE ON credentials FROM buxa_app;
GRANT UPDATE (revoked_at, token_ciphertext, token_iv, token_auth_tag) ON credentials TO buxa_app;

-- 4. Registration places: one per hold, one per enrolment, and the price at submission -----------------------------------------
DO $$
DECLARE
  dup_enrolments text;
  dup_holds text;
BEGIN
  SELECT string_agg(format('enrolment %s: places %s', d.enrolment_id, d.ids), E'\n  ' ORDER BY d.enrolment_id)
    INTO dup_enrolments
    FROM (
      SELECT enrolment_id, string_agg(id::text, ', ' ORDER BY created_at, id) AS ids
        FROM registration_classes WHERE enrolment_id IS NOT NULL
       GROUP BY enrolment_id HAVING count(*) > 1
    ) d;
  SELECT string_agg(format('hold %s: places %s', d.hold_id, d.ids), E'\n  ' ORDER BY d.hold_id)
    INTO dup_holds
    FROM (
      SELECT hold_id, string_agg(id::text, ', ' ORDER BY created_at, id) AS ids
        FROM registration_classes WHERE hold_id IS NOT NULL
       GROUP BY hold_id HAVING count(*) > 1
    ) d;
  IF dup_enrolments IS NOT NULL OR dup_holds IS NOT NULL THEN
    RAISE EXCEPTION E'Registration places share an enrolment or a hold, so the unique indexes were not added. Fix the rows and run again.\n  %\n  %',
      coalesce(dup_enrolments, 'no shared enrolments'), coalesce(dup_holds, 'no shared holds')
      USING ERRCODE = '23505', CONSTRAINT = 'registration_classes_enrolment_key';
  END IF;
END $$;

CREATE UNIQUE INDEX registration_classes_enrolment_key ON registration_classes (enrolment_id) WHERE enrolment_id IS NOT NULL;
CREATE UNIQUE INDEX registration_classes_hold_key ON registration_classes (hold_id) WHERE hold_id IS NOT NULL;

-- The price the family saw when it submitted: the amount in force that day (the early-bird amount when it applied), its currency,
-- and whether the early-bird amount was the one used. Null on rows written before this migration, and on a class with no price.
-- Written at insert only: the UPDATE grant on this table (0046) does not include these columns.
ALTER TABLE registration_classes
  ADD COLUMN price_minor integer CHECK (price_minor IS NULL OR price_minor BETWEEN 0 AND 99999999999),
  ADD COLUMN price_currency char(3) CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN early_bird_applied boolean,
  ADD CONSTRAINT registration_classes_price_shape CHECK (
    (price_minor IS NULL) = (price_currency IS NULL) AND (price_minor IS NOT NULL OR early_bird_applied IS NULL)
  );

-- 5. published_version names a real version ----------------------------------------------------------------------------------
DO $$
DECLARE
  found text;
BEGIN
  SELECT string_agg(format('form %s (camp %s): published_version %s has no version row', f.id, f.org_id, f.published_version), E'\n  ' ORDER BY f.id)
    INTO found
    FROM registration_forms f
   WHERE f.published_version IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM registration_form_versions v
        WHERE v.org_id = f.org_id AND v.form_id = f.id AND v.version = f.published_version
     );
  IF found IS NOT NULL THEN
    RAISE EXCEPTION E'Some forms name a published version that does not exist, so the foreign key was not added. Fix the rows and run again.\n  %', found
      USING ERRCODE = '23503', CONSTRAINT = 'registration_forms_published_version_fk';
  END IF;
END $$;

-- Nullable: a form that was never published has no version, and a null column is not checked (the default MATCH SIMPLE rule).
ALTER TABLE registration_forms
  ADD CONSTRAINT registration_forms_published_version_fk
  FOREIGN KEY (org_id, id, published_version) REFERENCES registration_form_versions (org_id, form_id, version);
