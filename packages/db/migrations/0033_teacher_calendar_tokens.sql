-- Teacher calendar feed: each teacher has their own link, which shows only the classes they are assigned to (class_teachers,
-- migration 0027). The camp-wide link (camp_calendar_tokens, 0028) is unchanged, and staff and admins keep it.
--
-- One active token per person per camp: the primary key is (org_id, user_id), so rotating replaces the hash on the same row and
-- the old URL stops working at once. Only the SHA-256 hash is stored, as for the camp token.
--
-- Tenant rules: org_id on the row, forced row-level security, and no hard deletes. The policy also limits each row to its own
-- person, so a teacher cannot write another teacher's token even inside the same camp.
--
-- The feed has no signed-in user. Two SECURITY DEFINER functions take only the token hash, as buxa_calendar_feed_classes does:
-- one resolves the camp (only for a teacher who is still a teacher), the other returns that teacher's assigned classes. Neither
-- takes a user id, so a caller cannot ask for another person's classes.

CREATE TABLE member_calendar_tokens (
  org_id      uuid NOT NULL,
  user_id     uuid NOT NULL,
  token_hash  bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id),
  FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE
);

ALTER TABLE member_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_calendar_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY member_calendar_tokens_tenant ON member_calendar_tokens FOR ALL TO buxa_app
  USING (org_id = current_org() AND user_id = current_user_id())
  WITH CHECK (org_id = current_org() AND user_id = current_user_id());

-- Least privilege: no DELETE. A removed member's row goes with the membership (ON DELETE CASCADE).
GRANT SELECT, INSERT, UPDATE ON member_calendar_tokens TO buxa_app;

-- The camp a teacher's token belongs to, while the person is still a teacher. Returns nothing for any other role.
CREATE FUNCTION buxa_teacher_for_calendar_token(p_hash bytea)
RETURNS TABLE (camp_id uuid, camp_name text, camp_archived boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.archived_at IS NOT NULL
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'teacher'
    JOIN orgs o ON o.id = t.org_id
   WHERE t.token_hash = p_hash;
$$;

-- The classes assigned to the token's teacher, in the token's camp, while the camp is not archived.
CREATE FUNCTION buxa_teacher_calendar_feed_classes(p_hash bytea)
RETURNS TABLE (id uuid, class_name text, starts_at timestamptz, ends_at timestamptz, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.name, s.starts_at, s.ends_at, s.location
    FROM member_calendar_tokens t
    JOIN org_members m ON m.org_id = t.org_id AND m.user_id = t.user_id AND m.role = 'teacher'
    JOIN orgs o ON o.id = t.org_id AND o.archived_at IS NULL
    JOIN class_teachers ct ON ct.org_id = t.org_id AND ct.user_id = t.user_id
    JOIN sessions s ON s.org_id = ct.org_id AND s.id = ct.session_id
   WHERE t.token_hash = p_hash
   ORDER BY s.starts_at, s.id;
$$;

REVOKE ALL ON FUNCTION buxa_teacher_for_calendar_token(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION buxa_teacher_calendar_feed_classes(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_teacher_for_calendar_token(bytea) TO buxa_app;
GRANT EXECUTE ON FUNCTION buxa_teacher_calendar_feed_classes(bytea) TO buxa_app;
