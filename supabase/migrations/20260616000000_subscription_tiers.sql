-- Migration: Subscription tiers + durable payment records (paid beta)
-- Created: 2026-06-16
-- Purpose: Add Free/Starter/Pro tiers, a payments ledger, and an idempotent
--          payment->tier entitlement RPC. One-time + 30-day window model.

-- ─── 1. Extend user_settings with tier + entitlement window ────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'starter', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMPTZ;

-- ─── 2. Payments ledger ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT NOT NULL UNIQUE,           -- idempotency key
  razorpay_payment_id TEXT,
  amount              INTEGER NOT NULL,               -- paise
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  tier_granted        TEXT CHECK (tier_granted IN ('starter', 'pro')),
  period_end          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users may read their own payment history.
CREATE POLICY "Users read own payments"
  ON public.payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins may read all payments (operational visibility for the beta).
CREATE POLICY "Admins read all payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Block ALL client-side writes. Inserts/updates happen only via the
-- service-role grant RPC below (server-side, after payment verification).
CREATE POLICY "Service role writes only - insert"
  ON public.payments FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role writes only - update"
  ON public.payments FOR UPDATE USING (false);

GRANT SELECT ON public.payments TO authenticated;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep the payments ledger out of realtime broadcasts.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.payments;
    END IF;
  END IF;
END $$;

-- ─── 3. Idempotent payment -> tier entitlement RPC ─────────────────────────
-- Called by the verify-payment edge function with the SERVICE ROLE only.
-- Upserts the payment row and grants the tier + 30-day window atomically.
-- Idempotent on razorpay_order_id: re-running for the same order never
-- double-grants or extends the window twice.
CREATE OR REPLACE FUNCTION public.grant_tier_from_payment(
  p_user_id     UUID,
  p_tier        TEXT,
  p_quota_limit INTEGER,
  p_period_end  TIMESTAMPTZ,
  p_order_id    TEXT,
  p_payment_id  TEXT,
  p_amount      INTEGER,
  p_currency    TEXT DEFAULT 'INR'
)
RETURNS TABLE (tier TEXT, period_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_status TEXT;
BEGIN
  IF p_tier NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  -- Idempotency: if this order was already marked paid, return current state
  -- without re-granting.
  SELECT status INTO v_existing_status
  FROM public.payments
  WHERE razorpay_order_id = p_order_id;

  IF v_existing_status = 'paid' THEN
    RETURN QUERY
      SELECT us.tier, us.plan_period_end
      FROM public.user_settings us
      WHERE us.user_id = p_user_id;
    RETURN;
  END IF;

  -- Record/settle the payment.
  INSERT INTO public.payments (
    user_id, razorpay_order_id, razorpay_payment_id, amount, currency,
    status, tier_granted, period_end
  )
  VALUES (
    p_user_id, p_order_id, p_payment_id, p_amount, p_currency,
    'paid', p_tier, p_period_end
  )
  ON CONFLICT (razorpay_order_id)
  DO UPDATE SET
    razorpay_payment_id = EXCLUDED.razorpay_payment_id,
    status              = 'paid',
    tier_granted        = EXCLUDED.tier_granted,
    period_end          = EXCLUDED.period_end,
    updated_at          = now();

  -- Grant the tier + quota + window on user_settings.
  INSERT INTO public.user_settings (user_id, tier, quota_limit, plan_period_end, updated_at)
  VALUES (p_user_id, p_tier, p_quota_limit, p_period_end, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier            = EXCLUDED.tier,
    quota_limit     = EXCLUDED.quota_limit,
    plan_period_end = EXCLUDED.plan_period_end,
    updated_at      = now();

  RETURN QUERY SELECT p_tier, p_period_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_tier_from_payment(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- ─── 4. S4: Block free-tier users from saving an API key (BYOK gate) ───────
-- Re-create upsert_encrypted_api_key with a tier guard. BYOK is a paid
-- capability (Starter/Pro); free users must upgrade first.
CREATE OR REPLACE FUNCTION public.upsert_encrypted_api_key(
  p_api_key TEXT,
  p_api_provider TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_user_id UUID;
  v_key_id UUID;
  v_encrypted BYTEA;
  v_tier TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be openai, anthropic, or openrouter';
  END IF;

  -- BYOK requires a paid tier with an active window.
  SELECT tier INTO v_tier
  FROM public.user_settings
  WHERE user_id = v_user_id;

  IF v_tier IS NULL OR v_tier = 'free'
     OR NOT EXISTS (
       SELECT 1 FROM public.user_settings
       WHERE user_id = v_user_id
         AND plan_period_end IS NOT NULL
         AND plan_period_end > now()
     )
  THEN
    RAISE EXCEPTION 'TIER_REQUIRED';
  END IF;

  -- Get key ID for encryption
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    SELECT id INTO v_key_id FROM pgsodium.create_key(name := 'user_api_key_key');
  END IF;

  -- Encrypt using pgsodium
  v_encrypted := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_api_key, 'utf8'),
    ''::bytea,
    v_key_id
  );

  -- Upsert
  INSERT INTO public.user_settings (user_id, api_key_enc, api_provider, updated_at)
  VALUES (v_user_id, encode(v_encrypted, 'base64'), p_api_provider, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    api_key_enc = EXCLUDED.api_key_enc,
    api_provider = EXCLUDED.api_provider,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT) TO authenticated;
