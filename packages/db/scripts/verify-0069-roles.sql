-- Verifies migration 0069 (docs/ROLES.md, "Migration of existing teacher logins").
-- For each login that was a teacher, it shows the access and the person roles before and after, and whether anything else
-- changed. Read-only apart from two scratch rows: it writes one table, verify_0069_before, which the "after" run reads and drops.
--
-- Run it on a COPY of the database, never the real one:
--   1. psql -v before=1 -f packages/db/scripts/verify-0069-roles.sql   (before 0069 is applied)
--   2. psql -v after=1  -f packages/db/scripts/verify-0069-roles.sql   (after 0069 is applied)
-- Run inside BEGIN ... ROLLBACK if you only want to look at the result without keeping the scratch table.

-- The snapshot of every login that is a teacher, or was (the same query in both runs).
\if :{?before}
DROP TABLE IF EXISTS verify_0069_before;
CREATE TABLE verify_0069_before AS
SELECT m.org_id, m.user_id, u.email, m.role::text AS access,
       coalesce(
         (SELECT array_agg(r.role ORDER BY r.role)
            FROM people p JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id
           WHERE p.org_id = m.org_id AND p.user_id = m.user_id),
         '{}') AS person_roles,
       (SELECT count(*) FROM people p JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
         WHERE p.org_id = m.org_id AND p.user_id = m.user_id) AS assigned_classes,
       (SELECT count(*) FROM member_options o WHERE o.org_id = m.org_id AND o.user_id = m.user_id AND o.enabled) AS options_on
  FROM org_members m
  JOIN users u ON u.id = m.user_id
 WHERE m.role = 'teacher';
SELECT 'snapshot taken' AS step, count(*) AS teachers FROM verify_0069_before;
\endif

-- The comparison (after 0069). A login is "ok" when it is now a viewer with the instructor role, keeps its classes and its options,
-- and nothing it had is lost.
\if :{?after}
WITH after AS (
  SELECT m.org_id, m.user_id, u.email, m.role::text AS access,
         coalesce(
           (SELECT array_agg(r.role ORDER BY r.role)
              FROM people p JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id
             WHERE p.org_id = m.org_id AND p.user_id = m.user_id),
           '{}') AS person_roles,
         (SELECT count(*) FROM people p JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
           WHERE p.org_id = m.org_id AND p.user_id = m.user_id) AS assigned_classes,
         (SELECT count(*) FROM member_options o WHERE o.org_id = m.org_id AND o.user_id = m.user_id AND o.enabled) AS options_on
    FROM org_members m
    JOIN users u ON u.id = m.user_id
)
SELECT b.email,
       b.access AS access_before,
       a.access AS access_after,
       b.person_roles AS person_roles_before,
       a.person_roles AS person_roles_after,
       b.assigned_classes AS classes_before,
       a.assigned_classes AS classes_after,
       b.options_on AS options_before,
       a.options_on AS options_after,
       CASE
         WHEN a.access = 'viewer'
          AND 'instructor' = ANY (a.person_roles)
          AND a.assigned_classes = b.assigned_classes
          AND a.options_on = b.options_on
         THEN 'ok: restricted teaching view, nothing lost'
         ELSE 'CHECK'
       END AS result
  FROM verify_0069_before b
  LEFT JOIN after a ON a.org_id = b.org_id AND a.user_id = b.user_id
 ORDER BY b.email;

-- Nothing may still be a teacher, and no login may be linked to two people in a camp.
SELECT 'teacher rows left' AS check, count(*) AS n FROM org_members WHERE role::text = 'teacher'
UNION ALL
SELECT 'teacher invites left', count(*) FROM member_invites WHERE role::text = 'teacher'
UNION ALL
SELECT 'logins linked to 2+ people', count(*) FROM (
  SELECT org_id, user_id FROM people WHERE user_id IS NOT NULL GROUP BY org_id, user_id HAVING count(*) > 1
) dup;

DROP TABLE verify_0069_before;
\endif
