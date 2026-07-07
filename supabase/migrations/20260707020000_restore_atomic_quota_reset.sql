-- F-016: increment_generation_count regressed. 20260626000000_monthly_quota_reset.sql
-- made the monthly reset atomic (reset generation_count/quota_period_start in
-- the same UPDATE when a new calendar month begins), but the later
-- 20260703080952_...sql migration re-created the function to add the
-- auth.uid() = p_user_id authorization check and, in doing so, dropped the
-- monthly-reset CASE logic and went back to plain `generation_count + 1`.
--
-- Net effect: a user's first generation in a new month reads effectiveCount=0
-- in checkQuota() (which independently derives the reset window), passes the
-- quota gate, but increments the stale row instead of resetting it. Every
-- later call that month keeps reading a stale, ever-growing count. Restore
-- the atomic reset while keeping the authorization check.
--
-- The authorization check is also corrected here: every edge function calls
-- this RPC with the SUPABASE_SERVICE_ROLE_KEY (see incrementGenerationCount()
-- in supabase/functions/_shared/promptHelpers.ts), under which auth.uid() is
-- NULL. The strict `auth.uid() IS NULL OR auth.uid() <> p_user_id` check from
-- 20260703080952 raises on every one of those calls, so the exception is
-- silently swallowed by the edge function's try/catch and generation counts
-- are never actually persisted. Only reject when a *user* JWT is present and
-- does not match p_user_id, so trusted service-role calls still work while a
-- direct authenticated-client RPC call still can't increment another user's count.

CREATE OR REPLACE FUNCTION public.increment_generation_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INTEGER;
  v_period_start TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_settings (user_id, generation_count, quota_period_start)
  VALUES (p_user_id, 1, v_period_start)
  ON CONFLICT (user_id) DO UPDATE
    SET
      -- If the stored period is from a previous month, reset count to 1 for this month.
      -- Otherwise increment as normal.
      generation_count = CASE
        WHEN user_settings.quota_period_start < v_period_start THEN 1
        ELSE user_settings.generation_count + 1
      END,
      quota_period_start = CASE
        WHEN user_settings.quota_period_start < v_period_start THEN v_period_start
        ELSE user_settings.quota_period_start
      END,
      updated_at = now()
  RETURNING generation_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_generation_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID) TO authenticated, service_role;
