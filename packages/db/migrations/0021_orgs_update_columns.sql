-- Narrow the request role's UPDATE on orgs to the two columns the app may change directly: name and timezone (the camp
-- rename in PgOrgRepository). 0001 granted UPDATE on the whole table, which let any admin run UPDATE orgs SET archived_at
-- and skip the owner check and the audit row that buxa_archive_camp and buxa_unarchive_camp (0013, 0017) write. Those two
-- functions and buxa_delete_camp (0013) are SECURITY DEFINER, so they run as the owner of orgs and are not affected by
-- this grant. The row-level policy orgs_update (0001) still applies to the columns that remain.
REVOKE UPDATE ON orgs FROM buxa_app;
GRANT UPDATE (name, timezone) ON orgs TO buxa_app;
