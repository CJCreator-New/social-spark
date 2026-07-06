-- Harden RLS/grants on internal metrics tables:
-- 1. api_metrics/query_performance are populated by server-side (service role) code only —
--    the "authenticated can insert" policy/grant let any logged-in user forge rows with no
--    ownership check. Service role bypasses RLS entirely, so these are unnecessary attack surface.
-- 2. api_performance_summary is a materialized view — Postgres RLS policies do not apply to
--    matviews, so granting SELECT to authenticated exposed all rows regardless of the
--    admin-only policy on the underlying api_metrics table.

DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON public.api_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert query performance" ON public.query_performance;

REVOKE INSERT ON public.api_metrics FROM authenticated;
REVOKE INSERT ON public.query_performance FROM authenticated;
REVOKE SELECT ON public.api_performance_summary FROM authenticated;
