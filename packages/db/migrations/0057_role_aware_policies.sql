-- Role-aware row policies, step one (docs/DB_URGENT_ACTION_PLAN.md, P1 "tenant RLS checks membership, not role").
--
-- Until now every camp table asked only "is the signed-in user a member of this camp". The role matrix lived in the app. This
-- migration moves the roles into the database for five policies, and no more:
--
--   audit_log             SELECT: admin and owner only (inserts stay open to every member: the audit trigger path and recordAudit)
--   credentials           INSERT, UPDATE: admin and owner only. SELECT stays open to every member (check-in scans resolve a badge by
--                         its hash) but the three ciphertext columns can no longer be read by the request role at all. Showing a
--                         badge again goes through buxa_reveal_badge() below.
--   camp_calendar_tokens  SELECT, INSERT, UPDATE: admin and owner only
--   member_options        reads: the member themself, admin, owner. Writes: admin and owner
--   notifications         INSERT: the signed-in user must be a member of the camp (an expired member is not)
--
-- Written to run safely on a database that holds data. No row is read or changed. Policies are altered in place (no drop), the
-- one new policy is additive, and the privilege change on credentials touches column grants only. Every role check uses the cheap
-- form `(SELECT is_member(current_org())) IN (...)`, so is_member() runs once per statement, not once per row.
--
-- People and enrolment writes are NOT part of this step. They come next, with tests for every role.
--
-- The credentials revoked-state trigger and the credentials UPDATE column grants belong to migration 0055 and are not touched here.

-- audit_log: only an admin or an owner reads the log. audit_write (the INSERT policy) is unchanged.
ALTER POLICY audit_read ON audit_log USING (
  org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));

-- credentials: the existing FOR ALL policy now needs an admin or owner (it governs INSERT and UPDATE; there is no DELETE grant).
-- A second, SELECT-only policy keeps the read open to every current member, as before.
ALTER POLICY credentials_tenant ON credentials
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'))
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));
CREATE POLICY credentials_member_read ON credentials FOR SELECT TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IS NOT NULL);

-- camp_calendar_tokens: the camp-wide calendar link is an admin or owner secret. The calendar feed reads it through
-- buxa_camp_for_calendar_token() and buxa_calendar_feed_classes(), which are definers and not affected.
ALTER POLICY camp_calendar_tokens_tenant ON camp_calendar_tokens
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'))
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));

-- member_options: an admin or owner reads and writes every option in the camp; a member reads their own. Writes still go through
-- buxa_set_member_option(), which checks the role as well.
ALTER POLICY member_options_tenant ON member_options
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'))
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('admin', 'owner'));
CREATE POLICY member_options_self_read ON member_options FOR SELECT TO buxa_app
  USING (org_id = current_org() AND user_id = current_user_id() AND (SELECT is_member(current_org())) IS NOT NULL);

-- notifications: any member writes a notification in their own camp, and no one else does.
ALTER POLICY notifications_insert ON notifications
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IS NOT NULL);

-- credentials: the request role loses SELECT on the sealed badge copy. It keeps SELECT on every other column, so scans and
-- badge lists work as before. A column added later is not readable by the request role until it is granted on purpose.
REVOKE SELECT ON credentials FROM buxa_app;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'credentials'
     AND column_name NOT IN ('token_ciphertext', 'token_iv', 'token_auth_tag');
  EXECUTE format('GRANT SELECT (%s) ON credentials TO buxa_app', cols);
END $$;

-- Showing a badge again. Returns the sealed copy of the person's active badge to the callers the app allows:
--   * an admin or owner of the camp (show and reprint), or
--   * the person themself (a roster person, not archived, whose email is the signed-in user's email), or
--   * a guardian of that person's household (the guardian is such a person, and the badge holder is a non-guardian member of a
--     household the guardian belongs to as a guardian).
-- Anyone else gets no row. The signed-in user comes from current_user_id() and is_member(), never from an argument. The service
-- still decides first and writes the audit row; this is the database's own check.
CREATE FUNCTION buxa_reveal_badge(p_org_id uuid, p_person_id uuid)
RETURNS TABLE (credential_id uuid, sealed_ciphertext bytea, sealed_iv bytea, sealed_auth_tag bytea)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT c.id, c.token_ciphertext, c.token_iv, c.token_auth_tag
    FROM credentials c
   WHERE c.org_id = p_org_id AND c.person_id = p_person_id AND c.revoked_at IS NULL
     AND is_member(p_org_id) IS NOT NULL
     AND (
       is_member(p_org_id) IN ('admin', 'owner')
       OR EXISTS (
         SELECT 1 FROM people s
           JOIN users u ON u.id = current_user_id()
          WHERE s.org_id = p_org_id AND s.id = p_person_id AND s.archived_at IS NULL AND lower(s.email) = lower(u.email))
       OR EXISTS (
         SELECT 1 FROM people g
           JOIN users u ON u.id = current_user_id()
           JOIN household_members hg ON hg.org_id = g.org_id AND hg.person_id = g.id AND hg.is_guardian
           JOIN household_members hc ON hc.org_id = hg.org_id AND hc.household_id = hg.household_id
                                    AND hc.person_id = p_person_id AND hc.person_id <> g.id AND NOT hc.is_guardian
          WHERE g.org_id = p_org_id AND g.archived_at IS NULL AND lower(g.email) = lower(u.email))
     );
$$;

REVOKE ALL ON FUNCTION buxa_reveal_badge(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_reveal_badge(uuid, uuid) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_reveal_badge(uuid, uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
