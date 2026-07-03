-- rate_limit_counters is dead attack surface: no application code writes to
-- it (the real limiter is Deno KV in supabase/functions/_shared/promptHelpers.ts
-- checkRateLimit()), yet `authenticated` had INSERT, letting any logged-in user
-- write forgeable rows. Since nothing legitimate depends on client-side writes,
-- remove INSERT entirely rather than trust a per-row ownership check.
DROP POLICY IF EXISTS "Users can insert their own rate limit data" ON public.rate_limit_counters;
REVOKE INSERT ON public.rate_limit_counters FROM authenticated;

-- Pin search_path and mark SECURITY DEFINER so these run with a fixed,
-- non-caller-controlled schema resolution (flagged by the Supabase linter).
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE created_at < now() - interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_rate_limit_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.rate_limit_stats;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_rate_limit_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_rate_limit_stats() TO service_role;
