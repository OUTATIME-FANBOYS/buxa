-- Unarchive a camp, owner only. It clears archived_at, so the camp is active again: its sign-in memberships, its people and
-- its attendance are unchanged, because nothing else on the camp was touched when it was archived (0013). The audit row is
-- written in the same statement, like the archive. Refuses a camp that is not archived.
CREATE FUNCTION buxa_unarchive_camp(p_org_id uuid, p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = p_actor_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Only the camp owner can unarchive it' USING ERRCODE = '42501';
  END IF;
  SELECT archived_at INTO v_at FROM orgs WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Camp not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'This camp is not archived' USING ERRCODE = '22023';
  END IF;
  UPDATE orgs SET archived_at = NULL WHERE id = p_org_id;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, p_actor_id, 'org.unarchive', 'org', p_org_id::text, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION buxa_unarchive_camp(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_unarchive_camp(uuid, uuid) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_unarchive_camp(uuid, uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
