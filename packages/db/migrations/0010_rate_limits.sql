-- Shared rate limits, so every serverless instance counts against the same window.
-- One row per limited key. The key is a hash of a rule name and an identity (a user id or a client address), so the table
-- holds no names, addresses or tokens. It is not tenant data, so it has no org_id and no tenant policy.
CREATE TABLE rate_limits (
  key          text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 128),
  window_start timestamptz NOT NULL,
  count        integer NOT NULL CHECK (count >= 0)
);
-- The catalogue test requires forced row-level security on every table. The one policy below applies to any role, but
-- only the function owner can reach the table: buxa_app and the Data API roles get no table privileges at all.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY rate_limits_function_only ON rate_limits FOR ALL USING (true) WITH CHECK (true);
REVOKE ALL ON rate_limits FROM PUBLIC;

-- The only way in. It counts one hit against a fixed window that starts at the first hit, and reports whether the hit is allowed.
-- Time comes from the database clock, so instances with skewed clocks agree. The search_path is fixed so a caller cannot
-- shadow the table or the functions it uses.
CREATE FUNCTION rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS TABLE (allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_count integer;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'rate limit settings are out of range' USING ERRCODE = '22023';
  END IF;
  INSERT INTO rate_limits AS r (key, window_start, count) VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE WHEN r.window_start <= v_now - make_interval(secs => p_window_seconds) THEN v_now ELSE r.window_start END,
    count        = CASE WHEN r.window_start <= v_now - make_interval(secs => p_window_seconds) THEN 1 ELSE r.count + 1 END
  RETURNING r.window_start, r.count INTO v_start, v_count;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after_seconds := greatest(ceil(extract(epoch FROM (v_start + make_interval(secs => p_window_seconds) - v_now)))::integer, 1);
  -- Now and then, drop windows that ended more than a day ago (the longest window allowed), so the table stays small.
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE window_start < v_now - interval '1 day';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION rate_limit_hit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rate_limit_hit(text, integer, integer) TO buxa_app;
