-- Tighten the audit log.
-- 1. The earlier rule let ANY nested trigger change audit rows. Now only the two things a foreign-key
--    action legitimately does are allowed: deleting an organisation removes its rows, and deleting a
--    user clears actor_id. Everything else, including every direct statement, is refused.
-- 2. TRUNCATE skipped the row triggers entirely. It is now refused too.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL
       AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only';
END $$;

CREATE FUNCTION audit_log_no_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log cannot be truncated'; END $$;

CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_no_truncate();
