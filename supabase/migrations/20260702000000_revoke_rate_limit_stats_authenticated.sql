-- rate_limit_stats is a materialized view; Postgres RLS cannot apply to matviews,
-- so the "grant select ... to authenticated" from 20260506_rate_limit_counters.sql
-- unconditionally exposed every user's per-user_id request counts/durations to any
-- other logged-in user. Restrict it to service_role only.
revoke select on public.rate_limit_stats from authenticated;
grant select on public.rate_limit_stats to service_role;
