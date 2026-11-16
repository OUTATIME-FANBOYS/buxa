-- Request handling runs as the restricted role buxa_app via SET LOCAL ROLE (see withOrg).
-- On a superuser connection (local development) that always works. On managed Postgres the connecting user is not a
-- superuser, and since Postgres 16 creating a role does NOT let its creator switch to it. Without this grant every
-- tenant query fails with "permission denied to set role". If the app connects as a different login than the one that
-- runs migrations, grant it too: GRANT buxa_app TO <that_login>;
GRANT buxa_app TO CURRENT_USER;
