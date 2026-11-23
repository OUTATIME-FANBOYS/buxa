-- Team access expiry (v0.3). A camp membership (org_members) can end on a date: expires_at. A null means no expiry, which is
-- every membership that exists today. Season passes (memberships, 0032) expire by their own dates and are not touched here.
--
-- A membership is live while expires_at is null or later than now(). An expired membership is treated as no membership at all:
--   * is_member() (0032) returns NULL for it, so every row policy that uses it (all camp data, org_members, audit) refuses it;
--   * buxa_memberships_of() and buxa_archived_memberships_of() leave the camp out, so the sign-in session never lists it and the
--     server's actorFor() refuses the camp with the same answer as a non-member;
--   * buxa_change_member_role() (0039) and the new buxa_set_member_expiry() check the actor's role only while it is live.
--
-- buxa_set_member_expiry(org, user, expires_at) sets or clears (null) one person's expiry. Same rules as a role change:
-- the actor must be an admin or owner, nobody changes their own, only an owner changes an owner's, and an archived camp is
-- read-only. It writes member.expiry_set or member.expiry_clear in the same statement.
--
-- The functions above that already exist are replaced with the same signature and privileges (CREATE OR REPLACE keeps the owner
-- and the grants). Nothing shipped is edited.

ALTER TABLE org_members ADD COLUMN expires_at timestamptz NULL;

CREATE OR REPLACE FUNCTION is_member(p_org uuid) RETURNS org_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.role FROM org_members m
   WHERE m.org_id = p_org AND m.user_id = current_user_id()
     AND (m.expires_at IS NULL OR m.expires_at > now());
$$;

CREATE OR REPLACE FUNCTION buxa_memberships_of()
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = current_user_id() AND o.archived_at IS NULL
     AND (m.expires_at IS NULL OR m.expires_at > now())
   ORDER BY o.name;
$$;

CREATE OR REPLACE FUNCTION buxa_archived_memberships_of()
RETURNS TABLE (member_org_id uuid, member_role org_role, org_name text, org_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT m.org_id, m.role, o.name, o.slug
    FROM org_members m JOIN orgs o ON o.id = m.org_id
   WHERE m.user_id = current_user_id() AND o.archived_at IS NOT NULL
     AND (m.expires_at IS NULL OR m.expires_at > now())
   ORDER BY o.name;
$$;

-- The actor's role must be live. Same body as 0039 otherwise.
CREATE OR REPLACE FUNCTION buxa_change_member_role(p_org_id uuid, p_user_id uuid, p_role org_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor org_role;
  v_current org_role;
  v_owners int;
  v_actor_id uuid := current_user_id();
BEGIN
  SELECT role INTO v_actor FROM org_members
   WHERE org_id = p_org_id AND user_id = v_actor_id AND (expires_at IS NULL OR expires_at > now());
  IF v_actor IS NULL OR v_actor NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only an admin or the owner can change roles' USING ERRCODE = '42501';
  END IF;
  IF v_actor_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot change your own role' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM orgs WHERE id = p_org_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This camp is archived' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_current FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Person not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor <> 'owner' AND (v_current = 'owner' OR p_role = 'owner') THEN
    RAISE EXCEPTION 'Only the owner can make or remove an owner' USING ERRCODE = '42501';
  END IF;
  IF v_current = 'owner' AND p_role <> 'owner' THEN
    SELECT count(*) INTO v_owners FROM org_members WHERE org_id = p_org_id AND role = 'owner';
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'A camp must keep at least one owner' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_current = p_role THEN
    RETURN;
  END IF;

  UPDATE org_members SET role = p_role WHERE org_id = p_org_id AND user_id = p_user_id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, v_actor_id, 'member.role_change', 'member', p_user_id::text,
            jsonb_build_object('from', v_current, 'to', p_role));
END;
$$;

-- Set or clear one member's expiry. p_expires_at null clears it. Rules: an admin or owner (live), not oneself, camp not archived,
-- the person is in the camp, and only an owner changes an owner's expiry (so an admin cannot expire the owner).
CREATE FUNCTION buxa_set_member_expiry(p_org_id uuid, p_user_id uuid, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor org_role;
  v_current org_role;
  v_current_expiry timestamptz;
  v_actor_id uuid := current_user_id();
BEGIN
  SELECT role INTO v_actor FROM org_members
   WHERE org_id = p_org_id AND user_id = v_actor_id AND (expires_at IS NULL OR expires_at > now());
  IF v_actor IS NULL OR v_actor NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only an admin or the owner can change access expiry' USING ERRCODE = '42501';
  END IF;
  IF v_actor_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot change your own access expiry' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM orgs WHERE id = p_org_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This camp is archived' USING ERRCODE = '42501';
  END IF;

  SELECT role, expires_at INTO v_current, v_current_expiry FROM org_members
   WHERE org_id = p_org_id AND user_id = p_user_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Person not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor <> 'owner' AND v_current = 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change an owner''s access expiry' USING ERRCODE = '42501';
  END IF;
  IF v_current_expiry IS NOT DISTINCT FROM p_expires_at THEN
    RETURN;
  END IF;

  UPDATE org_members SET expires_at = p_expires_at WHERE org_id = p_org_id AND user_id = p_user_id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, v_actor_id,
            CASE WHEN p_expires_at IS NULL THEN 'member.expiry_clear' ELSE 'member.expiry_set' END,
            'member', p_user_id::text,
            jsonb_build_object('from', v_current_expiry, 'to', p_expires_at));
END;
$$;

REVOKE ALL ON FUNCTION buxa_set_member_expiry(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_set_member_expiry(uuid, uuid, timestamptz) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_set_member_expiry(uuid, uuid, timestamptz) FROM %I', r);
    END IF;
  END LOOP;
END $$;
