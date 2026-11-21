-- Deleting a person (the owner's "Delete" on People, and the bulk delete). Owner only: the data:erase permission is owner-only.
--
-- The person row is removed in one statement. The foreign keys from memberships, enrolments, check-ins, badges (credentials),
-- instructor rows and household links to people (org_id, id) all cascade (0007, 0008, 0011), so their linked rows go with it.
-- Pending teacher invites sent to the person's email in this camp are removed too (member_invites has no DELETE grant for the
-- request role, so this runs as the owner). The audit row records the deletion without the person's details.
--
-- The signed-in user comes from current_user_id() (through is_member), never from an argument.
CREATE FUNCTION buxa_delete_person(p_org_id uuid, p_person_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
BEGIN
  IF is_member(p_org_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the camp owner can delete a person' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM orgs WHERE id = p_org_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This camp is archived' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_email FROM people WHERE org_id = p_org_id AND id = p_person_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_email IS NOT NULL THEN
    DELETE FROM member_invites WHERE org_id = p_org_id AND email = v_email AND accepted_at IS NULL;
  END IF;
  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
    VALUES (p_org_id, current_user_id(), 'person.delete', 'person', p_person_id::text, '{}'::jsonb);
  DELETE FROM people WHERE org_id = p_org_id AND id = p_person_id;
END;
$$;

REVOKE ALL ON FUNCTION buxa_delete_person(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_delete_person(uuid, uuid) TO buxa_app;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION buxa_delete_person(uuid, uuid) FROM %I', r);
    END IF;
  END LOOP;
END $$;
