-- Least privilege for org_members. Request handling (buxa_app) only ever reads memberships today; the one write path,
-- creating an organisation, runs on the privileged connection. The earlier FOR ALL policy let buxa_app insert, change or
-- delete any membership in its own organisation, so the API's role checks were the only barrier to granting yourself owner.
-- Reads stay scoped to the current organisation. When member-management routes are added, give them narrow, explicit write
-- policies (for example "an admin may change roles below their own") instead of widening this one.
DROP POLICY members_tenant ON org_members;
CREATE POLICY members_read ON org_members FOR SELECT TO buxa_app USING (org_id = current_org());
REVOKE INSERT, UPDATE, DELETE ON org_members FROM buxa_app;
