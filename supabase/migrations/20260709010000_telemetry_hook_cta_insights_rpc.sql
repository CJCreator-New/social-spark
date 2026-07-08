-- Migration: Self-scoped hook/CTA telemetry insights RPC
-- Created: 2026-07-09
-- Context: supabase/functions/telemetry/index.ts previously inserted rows with a
--          bogus `ts` column (telemetry_events has no such column, only
--          `created_at` with a DB default) which made every insert rejected by
--          PostgREST and silently swallowed by a console.warn — telemetry was
--          effectively a no-op. It also never populated `user_id`, so rows were
--          unattributable even though the column exists. Both are now fixed in
--          the Edge Function (ts removed; user_id populated via
--          getVerifiedUserId when a valid session bearer token is present).
--          Do not reintroduce the `ts` field or drop user_id population.
--
--          telemetry_events itself remains locked to service-role writes only
--          (see 20260515190000_queue_media_telemetry.sql) — there is no new
--          RLS SELECT policy on the table. This RPC is the only read surface,
--          and it is SECURITY DEFINER, hard-scoped to `auth.uid()` internally,
--          mirroring the regenerate_feedback precedent (service-role-only RLS
--          + no direct client reads).

CREATE OR REPLACE FUNCTION public.user_hook_cta_insights(days_back int DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_since   TIMESTAMPTZ;
  v_result  JSON;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF days_back IS NULL OR days_back <= 0 THEN
    days_back := 30;
  END IF;
  -- Cap the window to avoid unbounded scans from a malicious/huge input.
  IF days_back > 365 THEN
    days_back := 365;
  END IF;

  v_since := now() - (days_back || ' days')::interval;

  SELECT json_build_object(
    'hookRegenerateClicked', (
      SELECT count(*) FROM public.telemetry_events
      WHERE user_id = v_uid
        AND event_name = 'hook_regenerate_clicked'
        AND created_at > v_since
    ),
    'ctaRegenerateClicked', (
      SELECT count(*) FROM public.telemetry_events
      WHERE user_id = v_uid
        AND event_name = 'cta_regenerate_clicked'
        AND created_at > v_since
    ),
    'ctaSuggestionApplied', (
      SELECT count(*) FROM public.telemetry_events
      WHERE user_id = v_uid
        AND event_name = 'cta_suggestion_applied'
        AND created_at > v_since
    ),
    'postKept', (
      SELECT count(*) FROM public.telemetry_events
      WHERE user_id = v_uid
        AND event_name = 'post_kept'
        AND created_at > v_since
    ),
    'postRegeneratedAgain', (
      SELECT count(*) FROM public.telemetry_events
      WHERE user_id = v_uid
        AND event_name = 'post_regenerated_again'
        AND created_at > v_since
    ),
    'byPlatform', (
      SELECT COALESCE(json_object_agg(platform, cnt), '{}'::json)
      FROM (
        SELECT (props ->> 'platform') AS platform, count(*) AS cnt
        FROM public.telemetry_events
        WHERE user_id = v_uid
          AND event_name IN ('hook_regenerate_clicked', 'cta_regenerate_clicked', 'post_kept')
          AND created_at > v_since
          AND (props ->> 'platform') IS NOT NULL
        GROUP BY (props ->> 'platform')
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Self-scoped via auth.uid() inside the function body — safe for any
-- authenticated caller to invoke; it can only ever see its own rows.
GRANT EXECUTE ON FUNCTION public.user_hook_cta_insights(int) TO authenticated;
