-- Migration: Admin comp/whitelist tier grants + payments admin view (beta ops)
-- Created: 2026-06-17
-- Purpose: Let admins comp a tier to specific beta users without payment, and
--          provide a convenient read surface over the payments ledger.

-- ─── 1. Helper: is the current user an admin? ──────────────────────────────
-- Mirrors the existing admin checks (user_roles 'admin' OR admin_users).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── 2. Admin comp grant RPC ───────────────────────────────────────────────
-- Grants a tier + quota + window to a target user WITHOUT a real payment.
-- Records a synthetic 'comp' payment row so the ledger stays consistent and
-- auditable. Admin-only (raises if caller is not an admin).
CREATE OR REPLACE FUNCTION public.admin_grant_tier(
  p_target_user UUID,
  p_tier        TEXT,
  p_quota_limit INTEGER,
  p_days        INTEGER DEFAULT 30
)
RETURNS TABLE (tier TEXT, period_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_end TIMESTAMPTZ;
  v_order_id   TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_tier NOT IN ('free', 'starter', 'pro') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  -- Downgrade to free: clear the window.
  IF p_tier = 'free' THEN
    INSERT INTO public.user_settings (user_id, tier, plan_period_end, updated_at)
    VALUES (p_target_user, 'free', NULL, now())
    ON CONFLICT (user_id)
    DO UPDATE SET tier = 'free', plan_period_end = NULL, updated_at = now();
    RETURN QUERY SELECT 'free'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_period_end := now() + make_interval(days => GREATEST(1, p_days));
  -- Unique synthetic order id keeps the payments UNIQUE(order_id) constraint happy.
  v_order_id := 'comp_' || p_target_user::text || '_' || extract(epoch from now())::bigint;

  INSERT INTO public.payments (
    user_id, razorpay_order_id, razorpay_payment_id, amount, currency,
    status, tier_granted, period_end
  )
  VALUES (
    p_target_user, v_order_id, NULL, 0, 'INR',
    'paid', p_tier, v_period_end
  );

  INSERT INTO public.user_settings (user_id, tier, quota_limit, plan_period_end, updated_at)
  VALUES (p_target_user, p_tier, p_quota_limit, v_period_end, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier            = EXCLUDED.tier,
    quota_limit     = EXCLUDED.quota_limit,
    plan_period_end = EXCLUDED.plan_period_end,
    updated_at      = now();

  RETURN QUERY SELECT p_tier, v_period_end;
END;
$$;

-- Authenticated callers may invoke it, but the body enforces admin-only.
GRANT EXECUTE ON FUNCTION public.admin_grant_tier(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- ─── 3. Admin payments view ────────────────────────────────────────────────
-- security_invoker so the underlying payments RLS ("Admins read all payments")
-- is what governs access — non-admins see nothing.
CREATE OR REPLACE VIEW public.admin_payments AS
SELECT
  p.id,
  p.user_id,
  p.razorpay_order_id,
  p.razorpay_payment_id,
  p.amount,
  p.currency,
  p.status,
  p.tier_granted,
  p.period_end,
  p.created_at,
  (p.razorpay_order_id LIKE 'comp_%') AS is_comp
FROM public.payments p;

ALTER VIEW public.admin_payments SET (security_invoker = true);

GRANT SELECT ON public.admin_payments TO authenticated;
