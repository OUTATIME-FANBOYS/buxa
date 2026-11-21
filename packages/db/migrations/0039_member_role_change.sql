-- Changing a member's role (Team access, "Manage access"). Until now org_members had no UPDATE policy (0006 made it read-only),
-- so the only way to change a role was not possible at all. This function is the one place that writes it: it runs with the
-- owner's rights, takes the signed-in actor from the argument the app passes, checks the rules the database must hold, and writes
-- the audit row in the same statement. The signed-in user comes from current_user_id() (set by withOrg), never from an argument. The app checks members:change_role first;
-- this repeats the rules that must never break.
--
-- Rules: the actor must be an admin or owner of the camp; nobody changes their own role; only an owner makes or removes an
-- owner; the camp must keep at least one owner. An archived camp is read-only.

CREATE FUNCTION buxa_change_member_role(p_org_id uuid, p_user_id uuid, p_role org_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor org_role;
  v_current org_role;
  v_owners int;
  v_actor_id uuid := current_user_id();
BEGIN
  SELECT role INTO v_actor FROM org_members WHERE org_id = p_org_id AND user_id = v_actor_id;
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

REVOKE ALL ON FUNCTION buxa_change_member_role(uuid, uuid, org_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_change_member_role(uuid, uuid, org_role) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_change_member_role(uuid, uuid, org_role) FROM %I', r);
    END IF;
  END LOOP;
END $$;
