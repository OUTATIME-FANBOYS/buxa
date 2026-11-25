-- Check-in with a family's email (docs/phases/04-seats-rosters.md, "Check-in with a family's email").
--
-- Three things are new:
--   * camp_gates: the camp's static check-in link. The link's token is random; only its hash is a lookup key, and an encrypted copy
--     (AES-256-GCM, the same cipher as badges) lets an admin show the printed link again. An admin rotates it.
--   * gate_verification_codes: a 6-digit code sent to a family's registration email. Only a keyed hash of the code is kept (a pepper
--     from the server's environment), with its expiry, its attempt count and when it was used. The request role has no access at all:
--     the functions below are the only way to read or write it.
--   * device_tokens: a random token held by a family's phone, stored as a hash, scoped to one camp and one household, with an expiry
--     and a revocation. Staff with attendance:record can revoke one; nothing else changes it.
--
-- Gate access has no signed-in user, so the functions that serve it are SECURITY DEFINER and prove each step themselves (the token,
-- the household, the code consumed just now). Each one that writes also writes its audit row in the same statement.
-- Additive only: new tables, new functions, one new trigger. Nothing existing is changed.

-- 1. The camp's check-in link.
CREATE TABLE camp_gates (
  org_id           uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  token_hash       bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  token_ciphertext bytea NOT NULL,
  token_iv         bytea NOT NULL CHECK (octet_length(token_iv) = 12),
  token_auth_tag   bytea NOT NULL CHECK (octet_length(token_auth_tag) = 16),
  rotated_at       timestamptz NOT NULL DEFAULT now(),
  rotated_by       uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE camp_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE camp_gates FORCE ROW LEVEL SECURITY;
-- Only an admin or the owner reads or rotates the link (org:update in the matrix).
CREATE POLICY camp_gates_tenant ON camp_gates FOR ALL TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('owner', 'admin'))
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('owner', 'admin'));
GRANT SELECT, INSERT, UPDATE ON camp_gates TO buxa_app;

-- 2. Verification codes. No policy and no grant for the request role: only the definers below touch this table.
CREATE TABLE gate_verification_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  household_id    uuid NOT NULL,
  purpose         text NOT NULL CHECK (purpose IN ('gate', 'desk')),
  code_hash       bytea NOT NULL CHECK (octet_length(code_hash) = 32),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  used_at         timestamptz,
  -- True only when the code was entered correctly. A void code (too many wrong tries, or expired) is used but not verified.
  verified        boolean NOT NULL DEFAULT false,
  -- True once a device token has been issued for this code, so one code gives one device.
  device_issued   boolean NOT NULL DEFAULT false,
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, household_id) REFERENCES households (org_id, id) ON DELETE CASCADE,
  CHECK (expires_at > created_at),
  CHECK (NOT verified OR used_at IS NOT NULL),
  CHECK (NOT device_issued OR verified)
);
CREATE INDEX gate_codes_household_idx ON gate_verification_codes (org_id, household_id, purpose, created_at DESC);

ALTER TABLE gate_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_verification_codes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON gate_verification_codes FROM buxa_app;
-- Deny-all for the request role, stated as a policy so the table is protected like every other one. The definer functions below run
-- as the migration owner, which bypasses row-level security by design (see migration 0009), so they are not affected.
CREATE POLICY gate_verification_codes_deny ON gate_verification_codes FOR ALL TO buxa_app USING (false) WITH CHECK (false);

-- 3. Device tokens.
CREATE TABLE device_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  household_id  uuid NOT NULL,
  token_hash    bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, household_id) REFERENCES households (org_id, id) ON DELETE CASCADE,
  CHECK (expires_at > issued_at)
);
CREATE INDEX device_tokens_org_household_idx ON device_tokens (org_id, household_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;
-- Staff with attendance:record (owner, admin, staff) list the devices and revoke them. Nobody inserts a device except the
-- definer buxa_gate_issue_device_v1.
CREATE POLICY device_tokens_staff_read ON device_tokens FOR SELECT TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('owner', 'admin', 'staff'));
CREATE POLICY device_tokens_staff_revoke ON device_tokens FOR UPDATE TO buxa_app
  USING (org_id = current_org() AND (SELECT is_member(current_org())) IN ('owner', 'admin', 'staff'))
  WITH CHECK (org_id = current_org() AND (SELECT is_member(current_org())) IN ('owner', 'admin', 'staff'));
GRANT SELECT ON device_tokens TO buxa_app;
GRANT UPDATE (revoked_at, revoked_by) ON device_tokens TO buxa_app;

-- A revoked device stays revoked, and its identity fields never change.
CREATE FUNCTION device_tokens_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by) THEN
    RAISE EXCEPTION 'A revoked device cannot be reinstated' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'A device token identity cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER device_tokens_guard BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION device_tokens_guard();

-- ---------------------------------------------------------------------------------------------------------------------
-- Functions. Each is SECURITY DEFINER with a fixed search path, executable by the request role only.
-- ---------------------------------------------------------------------------------------------------------------------

-- The camp behind a gate link, while the camp is not archived. Returns only the name and time zone.
CREATE FUNCTION buxa_gate_resolve_camp_v1(p_token_hash bytea)
RETURNS TABLE (org_id uuid, camp_name text, camp_timezone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.timezone
    FROM camp_gates g JOIN orgs o ON o.id = g.org_id
   WHERE g.token_hash = p_token_hash AND o.archived_at IS NULL;
$$;

-- The household of a guardian who gave this email on a registration in the current camp (the camp set by withOrg). Returns the
-- household id only, never the email or any other detail. The caller gets the same empty answer for an unknown email.
CREATE FUNCTION buxa_gate_household_for_email_v1(p_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT hm.household_id
    FROM registrations r
    JOIN registration_classes rc ON rc.org_id = r.org_id AND rc.registration_id = r.id
    JOIN household_members hm ON hm.org_id = rc.org_id AND hm.person_id = rc.person_id
    JOIN people p ON p.org_id = hm.org_id AND p.id = hm.person_id AND p.archived_at IS NULL
   WHERE r.org_id = current_org()
     AND lower(btrim(r.answers->>'guardianEmail')) = lower(btrim(p_email))
   ORDER BY hm.household_id
   LIMIT 1;
$$;

-- Starts a code for a household. A gate request has no user; a desk request needs a staff member (or above) of the current camp.
-- Returns 'issued', 'cooldown' (a code was sent for this household in the last p_cooldown_seconds) or 'refused'. Earlier unused
-- codes of the same purpose are voided. Writes gate.code_request in the same statement when a code is issued.
CREATE FUNCTION buxa_gate_issue_code_v1(
  p_household uuid, p_purpose text, p_code_hash bytea, p_cooldown_seconds integer, p_ttl_seconds integer
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid := current_org();
  v_user uuid := current_user_id();
  v_role org_role := is_member(current_org());
BEGIN
  IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM households h WHERE h.org_id = v_org AND h.id = p_household) THEN
    RETURN 'refused';
  END IF;
  IF p_purpose = 'desk' AND (v_user IS NULL OR v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'staff')) THEN
    RETURN 'refused';
  END IF;
  IF EXISTS (
    SELECT 1 FROM gate_verification_codes c
     WHERE c.org_id = v_org AND c.household_id = p_household
       AND c.created_at > now() - make_interval(secs => p_cooldown_seconds)
  ) THEN
    RETURN 'cooldown';
  END IF;

  UPDATE gate_verification_codes c SET used_at = now()
   WHERE c.org_id = v_org AND c.household_id = p_household AND c.purpose = p_purpose AND c.used_at IS NULL;

  INSERT INTO gate_verification_codes (org_id, household_id, purpose, code_hash, expires_at, requested_by)
  VALUES (v_org, p_household, p_purpose, p_code_hash, now() + make_interval(secs => p_ttl_seconds), v_user);

  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
  VALUES (v_org, v_user, 'gate.code_request', 'household', p_household::text, jsonb_build_object('purpose', p_purpose));

  RETURN 'issued';
END $$;

-- Checks a code the family (or the staff member, for the desk) read or typed. Returns the outcome and the code's id:
--   'ok'      the code matched; it is used and verified
--   'wrong'   it did not match; one attempt is counted
--   'void'    it did not match and was the last allowed attempt; the code is void
--   'refused' there is no live code for this household (none, used, expired, or void), or the household is unknown (p_household
--             null). Nothing is revealed about which.
-- Every call writes gate.verify with the purpose and the outcome, in the same statement. A null household is recorded as a camp
-- entry, so an unknown email is audited without its address.
CREATE FUNCTION buxa_gate_consume_code_v1(
  p_household uuid, p_purpose text, p_code_hash bytea, p_max_attempts integer
)
RETURNS TABLE (outcome text, code_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid := current_org();
  v_user uuid := current_user_id();
  v_role org_role := is_member(current_org());
  c RECORD;
  v_result text := 'refused';
  v_code uuid;
  v_attempts integer;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No camp is set for this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_purpose = 'desk' AND (v_user IS NULL OR v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'staff')) THEN
    RAISE EXCEPTION 'The desk check-in needs a staff member' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_household IS NOT NULL THEN
    SELECT x.id, x.code_hash, x.attempts, x.expires_at INTO c
      FROM gate_verification_codes x
     WHERE x.org_id = v_org AND x.household_id = p_household AND x.purpose = p_purpose AND x.used_at IS NULL
     ORDER BY x.created_at DESC
     LIMIT 1
       FOR UPDATE;

    IF FOUND THEN
      v_code := c.id;
      IF c.expires_at <= now() OR c.attempts >= p_max_attempts THEN
        UPDATE gate_verification_codes SET used_at = now() WHERE id = c.id;
        v_result := 'refused';
      ELSIF c.code_hash = p_code_hash THEN
        UPDATE gate_verification_codes SET used_at = now(), verified = true, attempts = c.attempts + 1 WHERE id = c.id;
        v_result := 'ok';
      ELSE
        v_attempts := c.attempts + 1;
        IF v_attempts >= p_max_attempts THEN
          UPDATE gate_verification_codes SET attempts = v_attempts, used_at = now() WHERE id = c.id;
          v_result := 'void';
        ELSE
          UPDATE gate_verification_codes SET attempts = v_attempts WHERE id = c.id;
          v_result := 'wrong';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
  VALUES (
    v_org, v_user, 'gate.verify',
    CASE WHEN p_household IS NULL THEN 'camp' ELSE 'household' END,
    COALESCE(p_household::text, v_org::text),
    jsonb_build_object('purpose', p_purpose, 'outcome', v_result)
  );

  outcome := v_result;
  code_id := CASE WHEN v_result = 'ok' THEN v_code ELSE NULL END;
  RETURN NEXT;
END $$;

-- The device token for a verified gate code. Only for a code verified in the last five minutes, once. The token lasts until the
-- camp's season end (the latest occurrence's end), if that is still ahead; otherwise 180 days.
CREATE FUNCTION buxa_gate_issue_device_v1(p_code_id uuid, p_household uuid, p_token_hash bytea)
RETURNS TABLE (device_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid := current_org();
  v_season timestamptz;
  v_expires timestamptz;
  v_id uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No camp is set for this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM 1 FROM gate_verification_codes c
   WHERE c.id = p_code_id AND c.org_id = v_org AND c.household_id = p_household AND c.purpose = 'gate'
     AND c.verified AND NOT c.device_issued AND c.used_at > now() - interval '5 minutes'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No verified code for this device' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT max(s.ends_at) INTO v_season FROM sessions s WHERE s.org_id = v_org;
  v_expires := CASE WHEN v_season IS NOT NULL AND v_season > now() THEN v_season ELSE now() + interval '180 days' END;

  INSERT INTO device_tokens (org_id, household_id, token_hash, expires_at)
  VALUES (v_org, p_household, p_token_hash, v_expires)
  RETURNING id INTO v_id;

  UPDATE gate_verification_codes SET device_issued = true WHERE id = p_code_id;

  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
  VALUES (v_org, NULL, 'gate.device_issue', 'device', v_id::text, jsonb_build_object('householdId', p_household));

  device_id := v_id;
  expires_at := v_expires;
  RETURN NEXT;
END $$;

-- The live device for a token hash: not revoked, not expired, camp not archived. Used by the gate before anything else.
CREATE FUNCTION buxa_gate_device_v1(p_token_hash bytea)
RETURNS TABLE (device_id uuid, org_id uuid, household_id uuid, expires_at timestamptz, camp_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT d.id, d.org_id, d.household_id, d.expires_at, o.name
    FROM device_tokens d JOIN orgs o ON o.id = d.org_id
   WHERE d.token_hash = p_token_hash AND d.revoked_at IS NULL AND d.expires_at > now() AND o.archived_at IS NULL;
$$;

-- The children of a household booked for today (camp time): enrolled, on a live and active occurrence that starts today. Internal:
-- called only by the definers below, and not granted to the request role.
CREATE FUNCTION buxa_booked_today(p_org uuid, p_household uuid)
RETURNS TABLE (person_id uuid, given_name text, family_name text, session_id uuid, session_name text, on_site boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT DISTINCT p.id, p.given_name, p.family_name, c.id, c.name,
         EXISTS (SELECT 1 FROM check_ins ci WHERE ci.org_id = p.org_id AND ci.person_id = p.id AND ci.checked_out_at IS NULL)
    FROM household_members hm
    JOIN people p ON p.org_id = hm.org_id AND p.id = hm.person_id AND p.archived_at IS NULL
    JOIN enrolments e ON e.org_id = p.org_id AND e.person_id = p.id AND e.status = 'enrolled'
    JOIN sessions s ON s.org_id = e.org_id AND s.id = e.session_id
                   AND s.status = 'active' AND NOT s.dates_outside_session
    JOIN classes c ON c.org_id = s.org_id AND c.id = s.class_id AND c.status = 'live' AND c.archived_at IS NULL
    JOIN orgs o ON o.id = hm.org_id
   WHERE hm.org_id = p_org AND hm.household_id = p_household
     AND (s.starts_at AT TIME ZONE o.timezone)::date = (now() AT TIME ZONE o.timezone)::date;
$$;

-- The children a gate device may see: the household of a live device, booked today.
CREATE FUNCTION buxa_gate_children_v1(p_token_hash bytea)
RETURNS TABLE (person_id uuid, given_name text, family_name text, session_id uuid, session_name text, on_site boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT b.person_id, b.given_name, b.family_name, b.session_id, b.session_name, b.on_site
    FROM device_tokens d
    JOIN orgs o ON o.id = d.org_id AND o.archived_at IS NULL
    CROSS JOIN LATERAL buxa_booked_today(d.org_id, d.household_id) b
   WHERE d.token_hash = p_token_hash AND d.revoked_at IS NULL AND d.expires_at > now();
$$;

-- The same list for the desk: a staff member (or above) of the current camp, for a household of that camp.
CREATE FUNCTION buxa_desk_children_v1(p_household uuid)
RETURNS TABLE (person_id uuid, given_name text, family_name text, session_id uuid, session_name text, on_site boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT b.person_id, b.given_name, b.family_name, b.session_id, b.session_name, b.on_site
    FROM buxa_booked_today(current_org(), p_household) b
   WHERE (SELECT is_member(current_org())) IN ('owner', 'admin', 'staff');
$$;

-- One child checked in at the gate, by a live device for the child's household. Booked today in that session is required. Returns
-- 'ok', 'not_booked', 'already_on_site' or 'refused'. Writes attendance.check_in in the same statement, one row per child.
CREATE FUNCTION buxa_gate_check_in_v1(p_token_hash bytea, p_person_id uuid, p_session_id uuid, p_at timestamptz)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  d RECORD;
  b RECORD;
  v_unassigned boolean;
BEGIN
  SELECT x.org_id, x.household_id INTO d
    FROM device_tokens x JOIN orgs o ON o.id = x.org_id
   WHERE x.token_hash = p_token_hash AND x.revoked_at IS NULL AND x.expires_at > now() AND o.archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN 'refused';
  END IF;

  SELECT bt.on_site INTO b
    FROM buxa_booked_today(d.org_id, d.household_id) bt
   WHERE bt.person_id = p_person_id AND bt.session_id = p_session_id
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN 'not_booked';
  END IF;
  IF b.on_site THEN
    RETURN 'already_on_site';
  END IF;

  v_unassigned := NOT EXISTS (
    SELECT 1 FROM assignments a
     WHERE a.org_id = d.org_id AND a.session_id = p_session_id AND a.person_id = p_person_id AND a.active
  );

  BEGIN
    INSERT INTO check_ins (org_id, person_id, checked_in_at, checked_in_by, method, session_id, session_unassigned)
    VALUES (d.org_id, p_person_id, p_at, NULL, 'qr', p_session_id, v_unassigned);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_on_site';
  END;

  INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, data)
  VALUES (d.org_id, NULL, 'attendance.check_in', 'person', p_person_id::text,
          jsonb_build_object('via', 'gate', 'sessionId', p_session_id, 'sessionUnassigned', v_unassigned));

  RETURN 'ok';
END $$;

-- Grants. Every definer is pinned to a search path, is not executable by PUBLIC, and is executable by the request role only where
-- it is served to a request. buxa_booked_today is internal.
REVOKE ALL ON FUNCTION device_tokens_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_resolve_camp_v1(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_household_for_email_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_issue_code_v1(uuid, text, bytea, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_consume_code_v1(uuid, text, bytea, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_issue_device_v1(uuid, uuid, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_device_v1(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_booked_today(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_children_v1(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_desk_children_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_gate_check_in_v1(bytea, uuid, uuid, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION buxa_gate_resolve_camp_v1(bytea) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_household_for_email_v1(text) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_issue_code_v1(uuid, text, bytea, integer, integer) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_consume_code_v1(uuid, text, bytea, integer) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_issue_device_v1(uuid, uuid, bytea) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_device_v1(bytea) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_children_v1(bytea) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_desk_children_v1(uuid) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_gate_check_in_v1(bytea, uuid, uuid, timestamptz) TO buxa_app;
