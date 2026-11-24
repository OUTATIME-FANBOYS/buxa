-- Database integrity, part 2: names that look alike are the same name, and one email per person in a camp.
--
-- Written to run on a database that already holds data. Each new unique index is checked first; when rows would clash, the
-- migration stops with a message that lists them and changes nothing (the whole migration rolls back). Nothing is renamed or merged.
--
-- 1. buxa_name_key(text): the form a name is compared in. Unicode NFKC (full-width letters become plain letters, the
--    non-breaking space and the ideographic space become a space), then non-breaking space, zero-width characters and the
--    ideographic space are turned into a space, runs of white space collapse to one, the ends are trimmed, and the result is
--    lower case. packages/domain (nameKey) does the same in code, so keep the two in step.
-- 2. The unique indexes on session names (0052), group names and room names (0047) compare this form instead of lower case only.
-- 3. A person's email is unique in a camp, ignoring case and surrounding spaces.

CREATE FUNCTION buxa_name_key(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog
AS $$
  SELECT lower(btrim(regexp_replace(
    regexp_replace(normalize(p_name, NFKC), E'[\\u00a0\\u200b\\u200c\\u200d\\u2060\\ufeff\\u3000]', ' ', 'g'),
    '\s+', ' ', 'g')))
$$;

-- Duplicate checks. The migration login bypasses row-level security, so every camp is scanned.
DO $$
DECLARE
  sessions_found text;
  groups_found text;
  rooms_found text;
  emails_found text;
  problems text := '';
BEGIN
  SELECT string_agg(format('camp %s: %s', d.slug, d.names), E'\n  ' ORDER BY d.slug, d.names) INTO sessions_found
    FROM (
      SELECT o.slug, string_agg(c.name, ' | ' ORDER BY c.name) AS names
        FROM classes c JOIN orgs o ON o.id = c.org_id
       GROUP BY o.slug, c.org_id, buxa_name_key(c.name)
      HAVING count(*) > 1
    ) d;
  IF sessions_found IS NOT NULL THEN
    problems := problems || E'\nSession names that match once normalised:\n  ' || sessions_found;
  END IF;

  SELECT string_agg(format('session %s: %s', d.session_id, d.names), E'\n  ' ORDER BY d.session_id, d.names) INTO groups_found
    FROM (
      SELECT session_id, string_agg(name, ' | ' ORDER BY name) AS names
        FROM groups GROUP BY session_id, buxa_name_key(name) HAVING count(*) > 1
    ) d;
  IF groups_found IS NOT NULL THEN
    problems := problems || E'\nGroup names that match once normalised:\n  ' || groups_found;
  END IF;

  SELECT string_agg(format('session %s: %s', d.session_id, d.names), E'\n  ' ORDER BY d.session_id, d.names) INTO rooms_found
    FROM (
      SELECT session_id, string_agg(name, ' | ' ORDER BY name) AS names
        FROM rooms GROUP BY session_id, buxa_name_key(name) HAVING count(*) > 1
    ) d;
  IF rooms_found IS NOT NULL THEN
    problems := problems || E'\nRoom names that match once normalised:\n  ' || rooms_found;
  END IF;

  -- People are listed by id, not by email, so the message does not carry personal data.
  SELECT string_agg(format('camp %s: people %s', d.slug, d.ids), E'\n  ' ORDER BY d.slug, d.ids) INTO emails_found
    FROM (
      SELECT o.slug, string_agg(p.id::text, ', ' ORDER BY p.created_at, p.id) AS ids
        FROM people p JOIN orgs o ON o.id = p.org_id
       WHERE p.email IS NOT NULL
       GROUP BY o.slug, p.org_id, lower(btrim(p.email))
      HAVING count(*) > 1
    ) d;
  IF emails_found IS NOT NULL THEN
    problems := problems || E'\nPeople who share an email address (ignoring case and spaces):\n  ' || emails_found;
  END IF;

  IF problems <> '' THEN
    RAISE EXCEPTION E'Duplicates exist, so the unique indexes were not changed. Rename or fix them and run again.%', problems
      USING ERRCODE = '23505', CONSTRAINT = 'classes_org_name_normal_key';
  END IF;
END $$;

-- 2. The three name indexes keep their names (the app recognises the session one by name) and compare buxa_name_key(name).
-- drop-approved: phase 4 (each index is rebuilt under the same name on the stricter rule, in this same transaction)
DROP INDEX classes_org_name_normal_key;
CREATE UNIQUE INDEX classes_org_name_normal_key ON classes (org_id, buxa_name_key(name));

-- drop-approved: phase 4 (rebuilt under the same name on the stricter rule)
DROP INDEX groups_session_name_idx;
CREATE UNIQUE INDEX groups_session_name_idx ON groups (session_id, buxa_name_key(name));

-- drop-approved: phase 4 (rebuilt under the same name on the stricter rule)
DROP INDEX rooms_session_name_idx;
CREATE UNIQUE INDEX rooms_session_name_idx ON rooms (session_id, buxa_name_key(name));

-- 3. One email per person in a camp. A person with no email is not counted. The app writes the email in lower case.
CREATE UNIQUE INDEX people_org_email_key ON people (org_id, lower(btrim(email))) WHERE email IS NOT NULL;
