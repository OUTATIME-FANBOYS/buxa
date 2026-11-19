-- Calendar feed: one unguessable token per camp, stored only as its SHA-256 hash (the same approach as credential tokens).
-- The feed URL carries the token, so a calendar app can read it without signing in. The raw token is shown once, when it
-- is made; the database never holds it.
--
-- The table follows the camp's tenant rules: org_id on the row, forced row-level security, and no hard deletes. Rotating
-- the token replaces the hash on the same row, so the old URL stops working at once.
--
-- Feed reads have no signed-in user, so the token is resolved by buxa_camp_for_calendar_token, a SECURITY DEFINER function
-- (owner's rights, fixed search_path, executable by buxa_app only). It returns only what the feed needs: the camp's id,
-- name, zone and whether it is archived. It never returns any other row.

CREATE TABLE camp_calendar_tokens (
  org_id      uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camp_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE camp_calendar_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY camp_calendar_tokens_tenant ON camp_calendar_tokens FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());
GRANT SELECT, INSERT, UPDATE ON camp_calendar_tokens TO buxa_app;

CREATE OR REPLACE FUNCTION buxa_camp_for_calendar_token(p_hash bytea)
RETURNS TABLE (camp_id uuid, camp_name text, camp_timezone text, camp_archived boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.timezone, o.archived_at IS NOT NULL
    FROM camp_calendar_tokens t JOIN orgs o ON o.id = t.org_id
   WHERE t.token_hash = p_hash;
$$;

REVOKE ALL ON FUNCTION buxa_camp_for_calendar_token(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buxa_camp_for_calendar_token(bytea) TO buxa_app;
