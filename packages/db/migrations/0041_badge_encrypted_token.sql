-- Badges: an encrypted copy of the token, so the app can show a badge again later.
--
-- token_hash (SHA-256, 0007) stays the lookup key at check-in. The token itself is also stored, encrypted with AES-256-GCM. The key is
-- an environment secret (BADGE_ENCRYPTION_KEY), never in the database. The three columns are the ciphertext, the 12-byte IV and the
-- 16-byte GCM auth tag.
--
-- Badges issued before this migration have no encrypted copy: all three columns are NULL. The app then asks for a reissue to show
-- them. A revoked badge is wiped (see PgCredentialRepository), so only the active badge of each person ever holds a copy.
--
-- The existing grants (0007) and row-level security on credentials already cover new columns; nothing is granted here.

ALTER TABLE credentials
  ADD COLUMN token_ciphertext bytea,
  ADD COLUMN token_iv         bytea,
  ADD COLUMN token_auth_tag   bytea,
  ADD CONSTRAINT credentials_encrypted_token_shape CHECK (
    (token_ciphertext IS NULL AND token_iv IS NULL AND token_auth_tag IS NULL)
    OR (
      token_ciphertext IS NOT NULL
      AND octet_length(token_ciphertext) BETWEEN 16 AND 64
      AND octet_length(token_iv) = 12
      AND octet_length(token_auth_tag) = 16
    )
  );
