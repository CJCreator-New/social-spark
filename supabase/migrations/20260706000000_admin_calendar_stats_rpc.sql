-- Migration: Admin-scoped calendar stats RPC
-- Created: 2026-07-06
-- Purpose: fetchAdminStats() previously queried saved_calendars directly from the
--          browser client. RLS on saved_calendars only allows auth.uid() = user_id,
--          so the admin dashboard silently showed the admin's own calendar counts
--          instead of platform-wide stats, with no error surfaced. This RPC
--          aggregates server-side (bypassing RLS via SECURITY DEFINER) and is
--          admin-gated, mirroring the public.is_admin() pattern used by
--          admin_grant_tier/admin_payments.

CREATE OR REPLACE FUNCTION public.admin_calendar_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    TIMESTAMPTZ := date_trunc('day', now());
  v_week_ago TIMESTAMPTZ := v_today - interval '7 days';
  v_result   JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'calendarsToday', (SELECT count(*) FROM public.saved_calendars WHERE created_at > v_today),
    'calendarsWeek', (SELECT count(*) FROM public.saved_calendars WHERE created_at > v_week_ago),
    'activeUsersToday', (SELECT count(DISTINCT user_id) FROM public.saved_calendars WHERE created_at > v_today),
    'activeUsersWeek', (SELECT count(DISTINCT user_id) FROM public.saved_calendars WHERE created_at > v_week_ago),
    'totalCalendars', (SELECT count(*) FROM public.saved_calendars),
    'platformDistribution', (
      SELECT COALESCE(json_object_agg(platform, cnt), '{}'::json)
      FROM (
        SELECT platform, count(*) AS cnt
        FROM public.saved_calendars
        WHERE platform IS NOT NULL
        GROUP BY platform
      ) t
    ),
    'industryDistribution', (
      SELECT COALESCE(json_object_agg(industry, cnt), '{}'::json)
      FROM (
        SELECT industry, count(*) AS cnt
        FROM public.saved_calendars
        WHERE industry IS NOT NULL
        GROUP BY industry
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Authenticated callers may invoke it, but the body enforces admin-only via is_admin().
GRANT EXECUTE ON FUNCTION public.admin_calendar_stats() TO authenticated;
