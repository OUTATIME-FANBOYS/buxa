-- Links our user row to the identity provider's user id (Supabase auth.users.id).
-- We never store passwords; the provider owns credentials.
ALTER TABLE users ADD COLUMN auth_id uuid UNIQUE;
