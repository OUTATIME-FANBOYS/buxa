-- 0074: a person's date of birth and phone are required, in every form and in the database.
--
-- Invites carry a date of birth as well as a phone, so accepting an invite can create its person with both (buxa_accept_invite
-- below). The ALTERs at the end fail, on purpose, while any person has no date of birth or phone: real values have to be entered
-- for those people first. Nothing in this migration writes a value into a person.

ALTER TABLE member_invites ADD COLUMN date_of_birth date;

-- The accept function, as in 0069, with the new person taking the invite's phone and date of birth.
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
    -- A new person needs a phone and a date of birth (0074). An invite without them cannot create one: it is refused, and the
    -- transaction (the membership row above included) rolls back.
    IF v_invite.phone IS NULL OR v_invite.date_of_birth IS NULL THEN
      RAISE EXCEPTION 'This invite is missing details. Ask for a new invite.' USING ERRCODE = 'P0002', CONSTRAINT = 'invite_unusable';
    END IF;
    INSERT INTO people (org_id, given_name, family_name, email, phone, date_of_birth, user_id)
      VALUES (v_invite.org_id, v_first, coalesce(nullif(btrim(v_last), ''), v_first), v_invite.email, v_invite.phone,
              v_invite.date_of_birth, v_user)
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

ALTER TABLE people ALTER COLUMN date_of_birth SET NOT NULL;
ALTER TABLE people ALTER COLUMN phone SET NOT NULL;
