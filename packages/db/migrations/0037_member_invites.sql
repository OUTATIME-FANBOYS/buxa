-- Teacher invites (v0.3). A staff member, admin or owner invites a teacher by email. The invite carries the name and phone
-- the inviter typed (pre-filled, not final). The teacher opens the link, signs in with the same email, confirms their profile,
-- and joins the camp with the teacher role.
--
-- Only the SHA-256 hash of the random token is stored (the raw token is shown once, when the invite is created).
--
-- The profile phone is a new column on users, the one row the signed-in person owns. No new profile table is needed.
--
-- Three SECURITY DEFINER functions run with the owner's rights and take no user id argument. The signed-in user comes from
-- current_user_id() (app.user_id, set by withOrg). Each is granted to buxa_app only.

ALTER TABLE users ADD COLUMN phone text CHECK (phone IS NULL OR length(phone) BETWEEN 3 AND 32);

CREATE TABLE member_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       text NOT NULL CHECK (email = lower(email) AND position('@' in email) > 1),
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  phone       text CHECK (phone IS NULL OR length(phone) BETWEEN 3 AND 32),
  role        org_role NOT NULL CHECK (role = 'teacher'),
  token_hash  bytea NOT NULL CHECK (octet_length(token_hash) = 32),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);

CREATE UNIQUE INDEX member_invites_token_hash_idx ON member_invites(token_hash);
CREATE INDEX member_invites_pending_idx ON member_invites(org_id) WHERE accepted_at IS NULL;

ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invites FORCE ROW LEVEL SECURITY;
-- Staff, admins and owners read and create invites in their camp. Teachers and viewers see none.
CREATE POLICY member_invites_staff ON member_invites FOR ALL TO buxa_app
  USING (org_id = current_org() AND is_member(org_id) IN ('staff', 'admin', 'owner'))
  WITH CHECK (org_id = current_org() AND is_member(org_id) IN ('staff', 'admin', 'owner'));

-- No DELETE for the request role. UPDATE is granted on two columns only: "send again" replaces the token hash and the expiry
-- (the row policy above still limits it to staff, admins and owners in their own camp). Acceptance happens only in
-- buxa_accept_invite, which runs with the owner's rights.
GRANT SELECT, INSERT ON member_invites TO buxa_app;
GRANT UPDATE (token_hash, expires_at) ON member_invites TO buxa_app;

-- The signed-in person's own profile: first name, last name and phone. Writes only the row whose id is current_user_id().
CREATE FUNCTION buxa_set_user_profile(p_first_name text, p_last_name text, p_phone text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := current_user_id();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to save your profile' USING ERRCODE = '42501';
  END IF;
  UPDATE users
     SET first_name = p_first_name,
         last_name = nullif(p_last_name, ''),
         phone = nullif(p_phone, ''),
         name = left(btrim(p_first_name || ' ' || coalesce(nullif(p_last_name, ''), '')), 120)
   WHERE id = v_user;
END $$;

-- What the accept page may show before a person joins: the camp, the name and phone the inviter typed, and whether the
-- signed-in email is the invited one. Returns no row for an unknown, expired or used token, so the caller answers generically.
CREATE FUNCTION buxa_invite_for_accept(p_hash bytea)
RETURNS TABLE (org_id uuid, org_name text, invite_name text, invite_phone text, email_matches boolean, already_member boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT i.org_id,
         o.name,
         i.name,
         i.phone,
         (u.email = i.email),
         EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = i.org_id AND m.user_id = current_user_id())
    FROM member_invites i
    JOIN orgs o ON o.id = i.org_id AND o.archived_at IS NULL
    LEFT JOIN users u ON u.id = current_user_id()
   WHERE i.token_hash = p_hash AND i.accepted_at IS NULL AND i.expires_at > now();
$$;

-- Joining a camp. The signed-in user's email must equal the invite's. On success: the membership (role teacher) is created,
-- the invite is marked accepted, and the join is audited. Refusals use three constraint tags so the caller can tell them apart:
--   invite_unusable       unknown, expired or used token (the same answer for all three)
--   invite_wrong_email    the signed-in email is not the invited one
--   invite_already_member the signed-in person already belongs to this camp
-- A refusal raises, so the caller's transaction rolls back (a profile write made in the same transaction is undone too).
CREATE FUNCTION buxa_accept_invite(p_hash bytea)
RETURNS TABLE (org_id uuid, org_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := current_user_id();
  v_email text;
  v_invite member_invites%ROWTYPE;
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
  SELECT u.email INTO v_email FROM users u WHERE u.id = v_user;
  IF v_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'This invite is for another email address.' USING ERRCODE = '42501', CONSTRAINT = 'invite_wrong_email';
  END IF;
  IF EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = v_invite.org_id AND m.user_id = v_user) THEN
    RAISE EXCEPTION 'You are already in this camp.' USING ERRCODE = '22023', CONSTRAINT = 'invite_already_member';
  END IF;

  INSERT INTO org_members (org_id, user_id, role) VALUES (v_invite.org_id, v_user, 'teacher');
  UPDATE member_invites SET accepted_at = now(), accepted_by = v_user WHERE id = v_invite.id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (v_invite.org_id, v_user, 'member.invite_accept', 'member', v_user::text, '{"role":"teacher"}'::jsonb);

  RETURN QUERY SELECT o.id, o.name FROM orgs o WHERE o.id = v_invite.org_id;
END $$;

REVOKE ALL ON FUNCTION buxa_set_user_profile(text, text, text), buxa_invite_for_accept(bytea), buxa_accept_invite(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_user_profile(text, text, text), buxa_invite_for_accept(bytea), buxa_accept_invite(bytea) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_set_user_profile(text, text, text), buxa_invite_for_accept(bytea), buxa_accept_invite(bytea) FROM %I', r);
    END IF;
  END LOOP;
END $$;
