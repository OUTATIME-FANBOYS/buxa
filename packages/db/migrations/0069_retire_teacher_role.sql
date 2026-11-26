-- drop-approved: v0.4 (the teacher access level is retired. No release reads org_members.role = 'teacher', member_invites.role = 'teacher',
-- or the two org_members triggers that acted when a teacher stopped being one: they deleted class assignments and member options on a
-- role change. The member_invites check on role = 'teacher' is replaced by one on role = 'viewer'.)
--
-- 0069: retire the teacher access level. The agreed rules are in docs/ROLES.md; read that first.
--
-- Before: a teacher was an organization access level ('teacher' in org_members.role and member_invites.role). Teaching was a
-- separate thing (people with session_instructors rows, and people.user_id linking a login to its person).
-- After: teaching is the instructor person role. A teacher's login is kept, its organization access becomes 'viewer', and its
-- person (the instructor) keeps its class assignments. The "teaching view" (viewer access plus the instructor person role) keeps
-- exactly the grants a teacher had, so nobody gains or loses access. docs/ROLES.md, "Migration of existing teacher logins".
--
-- The steps, in order, all in one transaction (the runner wraps each file):
--   1. Refuse (raise) if one login is linked to more than one person in the same camp: the instructor to make is then ambiguous.
--   2. Give each teacher login a person in its camp. A login that already has one keeps it. Otherwise an unlinked person with the
--      login's email is linked to it; failing that, a person is created with the login's name and email, and no other data.
--   3. Give every teacher's person the instructor person role (person_roles, if it is missing).
--   4. Drop the two org_members triggers that acted on a teacher leaving the role: one deleted the class assignments
--      (org_members_drop_teacher_classes, from 0027 and 0051), one deleted the member options (org_members_drop_teacher_options,
--      from 0030). Both would delete data during step 5. The tables are not dropped: class_teachers (kept by 0051 until reviewed)
--      and member_options keep their rows.
--   5. Set org_members.role to 'viewer' for every teacher. The login and its membership stay.
--   6. member_invites: the role check moves from 'teacher' to 'viewer', and every teacher invite becomes a viewer invite. Accepting an
--      invite always gives the instructor person role (step 7's accept function), so no invite row needs a person role of its own.
--   7. Replace the functions that read 'teacher' so they read the teaching view instead: buxa_set_member_option (the target must be an
--      instructor with viewer access), buxa_accept_invite (a viewer membership, and the instructor role on the person), and the two
--      calendar feed functions (a viewer who is an instructor). Their signatures and grants do not change.
--   8. Refuse (raise) if any org_members or member_invites row still has 'teacher'. The org_role enum keeps the value 'teacher': PostgreSQL
--      cannot drop an enum value safely. No code may write it.
--
-- Nothing is deleted. verify-0069-roles.sql (in packages/db/scripts) lists each teacher's access and person roles before and after.

-- Step 1. Refuse, before anything changes, when a teacher cannot be given exactly one person:
--   (a) one login is linked to two people in the same camp;
--   (b) a teacher's email is the email of a person in the camp who is linked to a different login (the invite rules give a person
--       one login, and the people table holds one email per camp).
DO $$
DECLARE
  v_org uuid;
  v_user uuid;
  v_count integer;
BEGIN
  SELECT m.org_id, m.user_id, count(p.id) INTO v_org, v_user, v_count
    FROM org_members m
    JOIN people p ON p.org_id = m.org_id AND p.user_id = m.user_id
   WHERE m.role = 'teacher'
   GROUP BY m.org_id, m.user_id
  HAVING count(p.id) > 1
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'migration 0069: the login % is linked to % people in camp %. Unlink all but one before this migration runs.',
      v_user, v_count, v_org
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.org_id, m.user_id INTO v_org, v_user
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    JOIN people p ON p.org_id = m.org_id AND lower(btrim(p.email)) = lower(u.email)
   WHERE m.role = 'teacher' AND p.user_id IS NOT NULL AND p.user_id <> m.user_id
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'migration 0069: the teacher login % has the email of a person in camp % who is linked to another login. Resolve it before this migration runs.',
      v_user, v_org
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- Step 2. A person for each teacher login with none in its camp. An unlinked person with the login's email is linked to the login (the
-- people table allows one email per camp). Otherwise a person is created with the login's name and email, and no other data.
DO $$
DECLARE
  r record;
  v_person uuid;
BEGIN
  FOR r IN
    SELECT m.org_id, m.user_id, u.email, u.name, u.first_name, u.last_name
      FROM org_members m
      JOIN users u ON u.id = m.user_id
     WHERE m.role = 'teacher'
       AND NOT EXISTS (SELECT 1 FROM people p WHERE p.org_id = m.org_id AND p.user_id = m.user_id)
  LOOP
    SELECT p.id INTO v_person FROM people p
     WHERE p.org_id = r.org_id AND p.user_id IS NULL AND lower(btrim(p.email)) = lower(r.email)
     ORDER BY p.created_at, p.id
     LIMIT 1;
    IF v_person IS NOT NULL THEN
      UPDATE people SET user_id = r.user_id WHERE org_id = r.org_id AND id = v_person;
    ELSE
      INSERT INTO people (org_id, given_name, family_name, email, user_id)
        VALUES (r.org_id,
                left(coalesce(nullif(btrim(r.first_name), ''), nullif(btrim(r.name), ''), split_part(r.email, '@', 1)), 80),
                left(coalesce(nullif(btrim(r.last_name), ''), nullif(btrim(r.first_name), ''), nullif(btrim(r.name), ''),
                              split_part(r.email, '@', 1)), 80),
                r.email,
                r.user_id);
    END IF;
  END LOOP;
END $$;

-- Step 3. The instructor person role for every teacher's person (the primary key is (person_id, role), so a repeat does nothing).
INSERT INTO person_roles (org_id, person_id, role)
SELECT p.org_id, p.id, 'instructor'
  FROM people p
  JOIN org_members m ON m.org_id = p.org_id AND m.user_id = p.user_id
 WHERE m.role = 'teacher'
ON CONFLICT (person_id, role) DO NOTHING;

-- Step 4. The triggers that deleted data when a teacher stopped being one. They fire on the role change in step 5.
DROP TRIGGER IF EXISTS org_members_drop_teacher_classes ON org_members;
DROP FUNCTION IF EXISTS org_members_drop_teacher_classes();
DROP TRIGGER IF EXISTS org_members_drop_teacher_options ON org_members;
DROP FUNCTION IF EXISTS member_options_drop_teacher();

-- Step 5. The access level. Nothing else about the membership changes.
UPDATE org_members SET role = 'viewer' WHERE role = 'teacher';

-- Step 6. Invites. The check that allowed only 'teacher' now allows only 'viewer'.
ALTER TABLE member_invites DROP CONSTRAINT member_invites_role_check;
UPDATE member_invites SET role = 'viewer' WHERE role = 'teacher';
ALTER TABLE member_invites ADD CONSTRAINT member_invites_role_check CHECK (role = 'viewer');

-- Step 7a. Setting a member option: the target must be an instructor with viewer access (the teaching view). Same arguments and grants.
CREATE OR REPLACE FUNCTION buxa_set_member_option(p_org_id uuid, p_user_id uuid, p_option text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Not allowed to set options' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = current_user_id() THEN
    RAISE EXCEPTION 'Not allowed to change your own options' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM org_members m
         JOIN people p ON p.org_id = m.org_id AND p.user_id = m.user_id
         JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id AND r.role = 'instructor'
        WHERE m.org_id = p_org_id AND m.user_id = p_user_id AND m.role = 'viewer'
     ) THEN
    RAISE EXCEPTION 'Instructor not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO member_options (org_id, user_id, option_key, enabled, set_by, set_at)
    VALUES (p_org_id, p_user_id, p_option, p_enabled, current_user_id(), now())
  ON CONFLICT (org_id, user_id, option_key)
    DO UPDATE SET enabled = EXCLUDED.enabled, set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at;
END $$;

-- Step 7b. Accepting an invite (0051's version, with the teacher changes): a viewer membership, and the instructor person role
-- on the person, whether that person already existed or is created here.
CREATE OR REPLACE FUNCTION buxa_accept_invite(p_hash bytea)
RETURNS TABLE (org_id uuid, org_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := current_user_id();
  v_email text;
  v_invite member_invites%ROWTYPE;
  v_person uuid;
  v_first text;
  v_last text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'This invite cannot be used.' USING ERRCODE = 'P0002', CONSTRAINT = 'invite_unusable';
  END IF;
  SELECT * INTO v_invite FROM member_invites
   WHERE token_hash = p_hash AND accepted_at IS NULL AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite cannot be used.' USING ERRCODE = 'P0002', CONSTRAINT = 'invite_unusable';
  END IF;
  SELECT u.email, u.first_name, u.last_name INTO v_email, v_first, v_last FROM users u WHERE u.id = v_user;
  IF v_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'This invite is for another email address.' USING ERRCODE = '42501', CONSTRAINT = 'invite_wrong_email';
  END IF;
  IF EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = v_invite.org_id AND m.user_id = v_user) THEN
    RAISE EXCEPTION 'You are already in this camp.' USING ERRCODE = '22023', CONSTRAINT = 'invite_already_member';
  END IF;

  INSERT INTO org_members (org_id, user_id, role) VALUES (v_invite.org_id, v_user, 'viewer');

  -- The person with the invited email (the oldest one not yet linked to a login), linked to this login. The membership row
  -- above exists first, which the composite foreign key needs. With none, the person is created.
  SELECT p.id INTO v_person FROM people p
   WHERE p.org_id = v_invite.org_id AND lower(btrim(p.email)) = v_invite.email AND p.user_id IS NULL
   ORDER BY p.created_at, p.id
   LIMIT 1;
  IF v_person IS NOT NULL THEN
    UPDATE people SET user_id = v_user WHERE org_id = v_invite.org_id AND id = v_person;
  ELSE
    INSERT INTO people (org_id, given_name, family_name, email, phone, user_id)
      VALUES (v_invite.org_id, v_first, coalesce(nullif(btrim(v_last), ''), v_first), v_invite.email, v_invite.phone, v_user)
      RETURNING id INTO v_person;
  END IF;
  INSERT INTO person_roles (org_id, person_id, role) VALUES (v_invite.org_id, v_person, 'instructor')
    ON CONFLICT (person_id, role) DO NOTHING;

  UPDATE member_invites SET accepted_at = now(), accepted_by = v_user WHERE id = v_invite.id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (v_invite.org_id, v_user, 'member.invite_accept', 'member', v_user::text,
            '{"role":"viewer","instructor":true}'::jsonb);

  RETURN QUERY SELECT o.id, o.name FROM orgs o WHERE o.id = v_invite.org_id;
END $$;

-- Step 7c. The camp a teacher's calendar token belongs to (0033): a viewer whose person is an instructor.
CREATE OR REPLACE FUNCTION buxa_teacher_for_calendar_token(p_hash bytea)
RETURNS TABLE (camp_id uuid, camp_name text, camp_archived boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.archived_at IS NOT NULL
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'viewer'
    JOIN orgs o ON o.id = t.org_id
   WHERE t.token_hash = p_hash
     AND EXISTS (
       SELECT 1 FROM people p
         JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id AND r.role = 'instructor'
        WHERE p.org_id = t.org_id AND p.user_id = t.user_id
     );
$$;

-- Step 7d. The classes on a teacher's calendar feed (0064's version): a viewer whose person is an instructor, in the classes that
-- person is assigned to, in a camp that is not archived. A cancelled class is not on it.
CREATE OR REPLACE FUNCTION buxa_teacher_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'viewer'
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN people p ON p.org_id = t.org_id AND p.user_id = t.user_id
    JOIN person_roles pr ON pr.org_id = p.org_id AND pr.person_id = p.id AND pr.role = 'instructor'
    JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
    JOIN sessions s ON s.org_id = si.org_id AND s.id = si.session_id
   WHERE t.token_hash = p_hash
     AND s.status = 'active'
   ORDER BY s.starts_at, s.id;
$$;

-- Step 8. Nothing may still say 'teacher'. The enum value stays in the type (PostgreSQL cannot drop it safely); code never writes it.
DO $$
DECLARE
  v_left integer;
BEGIN
  SELECT (SELECT count(*) FROM org_members WHERE role::text = 'teacher')
       + (SELECT count(*) FROM member_invites WHERE role::text = 'teacher')
    INTO v_left;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'migration 0069: % row(s) still have the teacher access level', v_left USING ERRCODE = 'P0001';
  END IF;
END $$;
