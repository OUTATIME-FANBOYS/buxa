-- Phase 4 (v0.4): one source for a class's teachers. A class's teachers are its instructors (session_instructors, keyed by
-- person). A teacher's login is linked to its roster person (people.user_id), and a teacher sees a class only when its linked
-- person is one of the class's instructors. class_teachers (0027) is no longer read or written by the app.
--
-- Steps, in one transaction:
--   1. people.user_id: the login a person is. Nullable. Its composite foreign key (org_id, user_id) to org_members means the
--      login must be a member of the same camp, and removing the membership clears the link. A unique index allows one
--      person per login per camp.
--   2. Backfill. A class_teachers login is linked to the one person in the camp whose email matches the login's email
--      (case-insensitive, trimmed), when that is unambiguous: exactly one such person, and that person is not linked yet.
--   3. Copy each class_teachers row whose login now has a linked person into session_instructors (session_id, person_id),
--      unless the row is already there.
--   4. Rows with no unambiguous match are REPORTED (a NOTICE per row, with the class and the email) and are not copied or dropped.
--      The migration keeps class_teachers while any row is unmatched, until the owner has reviewed those rows.
--      Only when every row matches (including the empty table) are the table, its trigger and its assignment function dropped.
--   5. buxa_accept_invite links the accepting login to the person with the invited email in that camp (or creates that person
--      with the instructor role when none exists). It keeps the email rule: the signed-in email must equal the invite's.
--   6. buxa_teacher_calendar_feed_classes reads the classes through session_instructors and people.
--
-- The Edit class popup and buxa_replace_class_instructors_v2 are unchanged.

ALTER TABLE people ADD COLUMN user_id uuid;
ALTER TABLE people
  ADD CONSTRAINT people_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT people_org_member_fk FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id)
    ON DELETE SET NULL (user_id);
CREATE UNIQUE INDEX people_org_user_idx ON people (org_id, user_id) WHERE user_id IS NOT NULL;

-- Step 2. The login-to-person links that are unambiguous: the login has exactly one matching person in the camp, and that
-- person matches exactly one login. Anything else is left unlinked and reported in step 4.
WITH candidates AS (
  SELECT DISTINCT t.org_id, t.user_id, p.id AS person_id
    FROM class_teachers t
    JOIN users u ON u.id = t.user_id
    JOIN people p ON p.org_id = t.org_id
     AND lower(btrim(p.email)) = lower(btrim(u.email))
     AND p.user_id IS NULL
), links AS (
  SELECT c.org_id, c.user_id, c.person_id
    FROM candidates c
   WHERE (SELECT count(*) FROM candidates x WHERE x.org_id = c.org_id AND x.user_id = c.user_id) = 1
     AND (SELECT count(*) FROM candidates x WHERE x.org_id = c.org_id AND x.person_id = c.person_id) = 1
)
UPDATE people p
   SET user_id = l.user_id
  FROM links l
 WHERE p.org_id = l.org_id AND p.id = l.person_id;

-- Step 3. Copy the matched assignments. A row that already exists in session_instructors is not copied twice.
INSERT INTO session_instructors (org_id, session_id, person_id)
SELECT DISTINCT t.org_id, t.session_id, p.id
  FROM class_teachers t
  JOIN people p ON p.org_id = t.org_id AND p.user_id = t.user_id
 WHERE NOT EXISTS (
   SELECT 1 FROM session_instructors si
    WHERE si.session_id = t.session_id AND si.person_id = p.id
 );

-- Step 4. Report the rows that did not match, then drop class_teachers only when none is left.
DO $$
DECLARE
  unmatched record;
  unmatched_count integer := 0;
BEGIN
  FOR unmatched IN
    SELECT s.name AS class_name, u.email, s.id AS session_id
      FROM class_teachers t
      JOIN users u ON u.id = t.user_id
      JOIN sessions s ON s.org_id = t.org_id AND s.id = t.session_id
     WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.org_id = t.org_id AND p.user_id = t.user_id)
  LOOP
    unmatched_count := unmatched_count + 1;
    RAISE NOTICE 'migration 0051: unmatched class teacher: class "%" (session %), login email %; no person in the camp is linked to it',
      unmatched.class_name, unmatched.session_id, unmatched.email;
  END LOOP;

  IF unmatched_count > 0 THEN
    RAISE NOTICE 'migration 0051: % class teacher row(s) unmatched; class_teachers is KEPT until the owner has reviewed them', unmatched_count;
    RETURN;
  END IF;

  DROP TRIGGER org_members_drop_teacher_classes ON org_members;
  DROP FUNCTION org_members_drop_teacher_classes();
  DROP FUNCTION buxa_replace_class_teachers_v2(uuid, uuid, uuid[]);
  DROP TABLE class_teachers;
END $$;

-- drop-approved: v0.4 (the app reads and writes session_instructors and people.user_id; no running release uses class_teachers
-- once this migration runs, and the table is dropped only when every row was copied)

-- Step 5. Accepting an invite links the login to its person. The invite email must still be the signed-in email (0038).
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

  INSERT INTO org_members (org_id, user_id, role) VALUES (v_invite.org_id, v_user, 'teacher');

  -- The person with the invited email (the oldest one not yet linked to a login), linked to this login. The membership row
  -- above exists first, which the composite foreign key needs. With none, the person is created with the instructor role.
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
    INSERT INTO person_roles (org_id, person_id, role) VALUES (v_invite.org_id, v_person, 'instructor');
  END IF;

  UPDATE member_invites SET accepted_at = now(), accepted_by = v_user WHERE id = v_invite.id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (v_invite.org_id, v_user, 'member.invite_accept', 'member', v_user::text, '{"role":"teacher"}'::jsonb);

  RETURN QUERY SELECT o.id, o.name FROM orgs o WHERE o.id = v_invite.org_id;
END $$;

-- Step 6. The teacher's calendar feed: the classes its linked person is an instructor of.
CREATE OR REPLACE FUNCTION buxa_teacher_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'teacher'
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN people p ON p.org_id = t.org_id AND p.user_id = t.user_id
    JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
    JOIN sessions s ON s.org_id = si.org_id AND s.id = si.session_id
   WHERE t.token_hash = p_hash
   ORDER BY s.starts_at, s.id;
$$;
