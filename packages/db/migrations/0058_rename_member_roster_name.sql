-- A camp admin's rename changes the camp's roster name, not the login's global name.
--
-- buxa_rename_member_v2 (0032) wrote users.name, which is one row for the whole system, so an admin of one camp renamed a person
-- in every camp. The camp's own name for a person lives on people (given_name, family_name); the login's own name lives on users
-- and only that user edits it (buxa_set_user_name). From now on a rename:
--
--   * updates the people row linked to the member (people.user_id, migration 0051) in this camp, and nothing else;
--   * leaves users, and the people rows of every other camp, alone;
--   * is refused with a clear message when the member has no people row in this camp.
--
-- The name is split at the first space: the first word is the given name, the rest the family name. A single word is used for both,
-- as the invite acceptance (0051) does. The signature and the returned columns do not change (user_name is now the roster name),
-- so CREATE OR REPLACE keeps the owner and the grants, and the running release keeps working. No data is changed by this migration.
CREATE OR REPLACE FUNCTION buxa_rename_member_v2(p_org_id uuid, p_target_user_id uuid, p_name text)
RETURNS TABLE (user_id uuid, user_email text, user_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  v_name   text := btrim(p_name);
  v_given  text := split_part(btrim(p_name), ' ', 1);
  v_family text := nullif(btrim(substr(btrim(p_name), length(split_part(btrim(p_name), ' ', 1)) + 1)), '');
  v_person uuid;
  v_email  text;
BEGIN
  IF is_member(p_org_id) IS NULL OR is_member(p_org_id) NOT IN ('admin', 'owner') THEN
    RETURN;
  END IF;
  SELECT u.email INTO v_email FROM users u
   WHERE u.id = p_target_user_id
     AND EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = p_org_id AND m.user_id = p_target_user_id);
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT p.id INTO v_person FROM people p WHERE p.org_id = p_org_id AND p.user_id = p_target_user_id;
  IF v_person IS NULL THEN
    RAISE EXCEPTION 'This member has no person on the camp roster, so there is no camp name to change.'
      USING ERRCODE = 'P0002', CONSTRAINT = 'rename_no_person';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter a name.' USING ERRCODE = '22023';
  END IF;

  UPDATE people SET given_name = v_given, family_name = coalesce(v_family, v_given)
   WHERE org_id = p_org_id AND id = v_person;

  RETURN QUERY SELECT p_target_user_id, v_email, v_name;
END $$;
