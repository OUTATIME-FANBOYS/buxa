-- Session membership, CONTRACT step. Do NOT place this file in packages/db/migrations until the v0.2.3 release is retired
-- (no instance serving it, see docs/deploy.md). Running it earlier breaks that release: its sign-in, archive and delete calls
-- use the old signatures dropped here, and its reads fail once the policies below require a signed-in member.
--
-- It drops the old owner-rights overloads and the old _v2-less names, requires a signed-in member in every row policy, and
-- then the audit-5.1 fix is complete. The migration numbering guard expects it at 0033 once moved.
-- drop-approved: v0.3

DROP FUNCTION buxa_memberships_of(uuid);
DROP FUNCTION buxa_archived_camps_of(uuid);
DROP FUNCTION buxa_archived_memberships_of(uuid);
DROP FUNCTION buxa_create_org(text, text, text, uuid);
DROP FUNCTION buxa_archive_camp(uuid, uuid);
DROP FUNCTION buxa_unarchive_camp(uuid, uuid);
DROP FUNCTION buxa_delete_camp(uuid, uuid, text);
DROP FUNCTION buxa_set_user_name(uuid, text, text);
DROP FUNCTION buxa_set_user_clock_format(uuid, text);
DROP FUNCTION buxa_rename_member(uuid, uuid, text);
DROP FUNCTION buxa_delete_class(uuid, uuid);
DROP FUNCTION buxa_replace_class_instructors(uuid, uuid, uuid[]);
DROP FUNCTION buxa_replace_class_teachers(uuid, uuid, uuid[]);
DROP FUNCTION buxa_replace_form_sessions(uuid, uuid, uuid[]);

-- Row policies: the row's camp must be the current one AND the signed-in user must be a member of it.
ALTER POLICY orgs_self ON orgs USING (id = current_org() AND is_member(id) IS NOT NULL);
ALTER POLICY orgs_update ON orgs
  USING (id = current_org() AND is_member(id) IS NOT NULL)
  WITH CHECK (id = current_org() AND is_member(id) IS NOT NULL);
ALTER POLICY users_in_org ON users USING (
  EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = users.id AND m.org_id = current_org())
  AND is_member(current_org()) IS NOT NULL);
ALTER POLICY members_read ON org_members USING (org_id = current_org() AND is_member(org_id) IS NOT NULL);
ALTER POLICY audit_read ON audit_log USING (org_id = current_org() AND is_member(org_id) IS NOT NULL);
ALTER POLICY audit_write ON audit_log WITH CHECK (org_id = current_org() AND is_member(org_id) IS NOT NULL);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people', 'person_roles', 'households', 'household_members', 'memberships', 'credentials',
    'check_ins', 'classes', 'sessions', 'enrolments', 'session_instructors', 'class_teachers', 'seat_holds',
    'camp_calendar_tokens', 'registration_forms', 'registration_form_sessions', 'registration_form_versions',
    'registrations', 'registration_sessions'] LOOP
    EXECUTE format('ALTER POLICY %I ON %I USING (org_id = current_org() AND is_member(org_id) IS NOT NULL) WITH CHECK (org_id = current_org() AND is_member(org_id) IS NOT NULL)', t || '_tenant', t);
  END LOOP;
END $$;
