-- Migration: monthly quota reset
-- Adds quota_period_start to user_settings and replaces increment_generation_count
-- with a monthly-aware version that resets the count at the start of each calendar month.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add quota_period_start column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS quota_period_start TIMESTAMPTZ
    NOT NULL
    DEFAULT date_trunc('month', now());

-- Back-fill existing rows: assign them to the current month.
-- Their generation_count will continue from wherever it was until the next
-- calendar month, at which point the RPC will reset it automatically.
UPDATE public.user_settings
SET quota_period_start = date_trunc('month', now())
WHERE quota_period_start IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace increment_generation_count with monthly-aware version
-- ─────────────────────────────────────────────────────────────────────────────
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

-- Grant execute to authenticated users and service role (mirrors existing grants)
GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID)
  TO authenticated, service_role;
