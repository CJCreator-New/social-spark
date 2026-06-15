-- ============================================================================
-- COMBINED CATCH-UP MIGRATION (run once in the Supabase SQL Editor)
--
-- The live database (project mbxlvsftyifovbkpsvyw) is missing several
-- migrations: user_settings, admin_users, the API-key RPCs, the pilot quota
-- columns, and the new subscription-tier work. This file applies them in the
-- correct dependency order, idempotently, in a single transaction.
--
-- Safe to re-run: every CREATE POLICY is preceded by DROP POLICY IF EXISTS,
-- tables use IF NOT EXISTS, functions use CREATE OR REPLACE.
--
-- Prerequisites already present (verified): pgsodium, user_roles,
-- public.update_updated_at_column().
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- A) admin_users  (from 20260506_admin_users.sql)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin users list" ON public.admin_users;
CREATE POLICY "Admins can view admin users list"
  ON public.admin_users FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

DROP POLICY IF EXISTS "Super admin can manage admin users" ON public.admin_users;
CREATE POLICY "Super admin can manage admin users"
  ON public.admin_users FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

GRANT SELECT ON public.admin_users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_created_at ON public.admin_users(created_at);

-- ────────────────────────────────────────────────────────────────────────────
-- B) user_settings + API-key RPCs  (from 20260609123000_user_settings.sql)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  api_key_enc TEXT,
  api_provider TEXT NOT NULL DEFAULT 'openai' CHECK (api_provider IN ('openai', 'anthropic', 'openrouter')),
  use_own_key BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user settings" ON public.user_settings;
CREATE POLICY "Users can view own user settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user settings" ON public.user_settings;
CREATE POLICY "Users can insert own user settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user settings" ON public.user_settings;
CREATE POLICY "Users can update own user settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own user settings" ON public.user_settings;
CREATE POLICY "Users can delete own user settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE name = 'user_api_key_key') THEN
    PERFORM pgsodium.create_key(name := 'user_api_key_key');
  END IF;
END $$;

-- get_decrypted_api_key (created here; upsert is created in section G with the
-- tier guard so we don't define it twice).
CREATE OR REPLACE FUNCTION public.get_decrypted_api_key()
RETURNS TABLE (decrypted_key TEXT, api_provider TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_key_id UUID;
  v_encrypted_base64 TEXT;
  v_provider TEXT;
  v_decrypted BYTEA;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT api_key_enc, user_settings.api_provider INTO v_encrypted_base64, v_provider
  FROM public.user_settings WHERE user_id = v_user_id;

  IF v_encrypted_base64 IS NULL THEN RETURN; END IF;

  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN RAISE EXCEPTION 'Encryption key not found'; END IF;

  BEGIN
    v_decrypted := pgsodium.crypto_aead_det_decrypt(
      decode(v_encrypted_base64, 'base64'), ''::bytea, v_key_id);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Decryption failed'; END;

  RETURN QUERY SELECT convert_from(v_decrypted, 'utf8'), v_provider;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- C) API-key security hardening  (from 20260609124000_*)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_key_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('saved', 'deleted', 'used', 'toggled')),
  provider   TEXT,
  source     TEXT CHECK (source IN ('platform', 'user')),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_key_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own audit log" ON public.api_key_audit_log;
CREATE POLICY "Users read own audit log"
  ON public.api_key_audit_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all audit logs" ON public.api_key_audit_log;
CREATE POLICY "Admins read all audit logs"
  ON public.api_key_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role inserts only" ON public.api_key_audit_log;
CREATE POLICY "Service role inserts only"
  ON public.api_key_audit_log FOR INSERT WITH CHECK (false);

GRANT SELECT ON public.api_key_audit_log TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- D) key_mode column  (from 20260613000000_*)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS key_mode TEXT NOT NULL DEFAULT 'fallback'
    CHECK (key_mode IN ('fallback', 'always'));

-- ────────────────────────────────────────────────────────────────────────────
-- E) pilot quota  (from 20260614000000_*)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS generation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_limit INTEGER NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.increment_generation_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO public.user_settings (user_id, generation_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET generation_count = public.user_settings.generation_count + 1
  RETURNING generation_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- F + G) tier columns, payments ledger, grant RPC, BYOK-guarded upsert
--        (from 20260615 + 20260616)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'starter', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  amount              INTEGER NOT NULL,
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

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
CREATE POLICY "Users read own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all payments" ON public.payments;
CREATE POLICY "Admins read all payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role writes only - insert" ON public.payments;
CREATE POLICY "Service role writes only - insert"
  ON public.payments FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Service role writes only - update" ON public.payments;
CREATE POLICY "Service role writes only - update"
  ON public.payments FOR UPDATE USING (false);

GRANT SELECT ON public.payments TO authenticated;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.grant_tier_from_payment(
  p_user_id UUID, p_tier TEXT, p_quota_limit INTEGER, p_period_end TIMESTAMPTZ,
  p_order_id TEXT, p_payment_id TEXT, p_amount INTEGER, p_currency TEXT DEFAULT 'INR'
)
RETURNS TABLE (tier TEXT, period_end TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existing_status TEXT;
BEGIN
  IF p_tier NOT IN ('starter', 'pro') THEN RAISE EXCEPTION 'Invalid tier: %', p_tier; END IF;

  SELECT status INTO v_existing_status FROM public.payments WHERE razorpay_order_id = p_order_id;
  IF v_existing_status = 'paid' THEN
    RETURN QUERY SELECT us.tier, us.plan_period_end FROM public.user_settings us WHERE us.user_id = p_user_id;
    RETURN;
  END IF;

  INSERT INTO public.payments (user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, tier_granted, period_end)
  VALUES (p_user_id, p_order_id, p_payment_id, p_amount, p_currency, 'paid', p_tier, p_period_end)
  ON CONFLICT (razorpay_order_id) DO UPDATE SET
    razorpay_payment_id = EXCLUDED.razorpay_payment_id, status = 'paid',
    tier_granted = EXCLUDED.tier_granted, period_end = EXCLUDED.period_end, updated_at = now();

  INSERT INTO public.user_settings (user_id, tier, quota_limit, plan_period_end, updated_at)
  VALUES (p_user_id, p_tier, p_quota_limit, p_period_end, now())
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier, quota_limit = EXCLUDED.quota_limit,
    plan_period_end = EXCLUDED.plan_period_end, updated_at = now();

  RETURN QUERY SELECT p_tier, p_period_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_tier_from_payment(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- upsert_encrypted_api_key WITH the tier guard (single definition).
CREATE OR REPLACE FUNCTION public.upsert_encrypted_api_key(
  p_api_key TEXT, p_api_provider TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_key_id UUID;
  v_encrypted BYTEA;
  v_tier TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be openai, anthropic, or openrouter';
  END IF;

  SELECT tier INTO v_tier FROM public.user_settings WHERE user_id = v_user_id;

  IF v_tier IS NULL OR v_tier = 'free'
     OR NOT EXISTS (
       SELECT 1 FROM public.user_settings
       WHERE user_id = v_user_id AND plan_period_end IS NOT NULL AND plan_period_end > now()
     )
  THEN
    RAISE EXCEPTION 'TIER_REQUIRED';
  END IF;

  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN SELECT id INTO v_key_id FROM pgsodium.create_key(name := 'user_api_key_key'); END IF;

  v_encrypted := pgsodium.crypto_aead_det_encrypt(convert_to(p_api_key, 'utf8'), ''::bytea, v_key_id);

  INSERT INTO public.user_settings (user_id, api_key_enc, api_provider, updated_at)
  VALUES (v_user_id, encode(v_encrypted, 'base64'), p_api_provider, now())
  ON CONFLICT (user_id) DO UPDATE SET
    api_key_enc = EXCLUDED.api_key_enc, api_provider = EXCLUDED.api_provider, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- H) admin comp grants + payments view  (from 20260617)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_tier(
  p_target_user UUID, p_tier TEXT, p_quota_limit INTEGER, p_days INTEGER DEFAULT 30
)
RETURNS TABLE (tier TEXT, period_end TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_period_end TIMESTAMPTZ; v_order_id TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_tier NOT IN ('free', 'starter', 'pro') THEN RAISE EXCEPTION 'Invalid tier: %', p_tier; END IF;

  IF p_tier = 'free' THEN
    INSERT INTO public.user_settings (user_id, tier, plan_period_end, updated_at)
    VALUES (p_target_user, 'free', NULL, now())
    ON CONFLICT (user_id) DO UPDATE SET tier = 'free', plan_period_end = NULL, updated_at = now();
    RETURN QUERY SELECT 'free'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_period_end := now() + make_interval(days => GREATEST(1, p_days));
  v_order_id := 'comp_' || p_target_user::text || '_' || extract(epoch from now())::bigint;

  INSERT INTO public.payments (user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, tier_granted, period_end)
  VALUES (p_target_user, v_order_id, NULL, 0, 'INR', 'paid', p_tier, v_period_end);

  INSERT INTO public.user_settings (user_id, tier, quota_limit, plan_period_end, updated_at)
  VALUES (p_target_user, p_tier, p_quota_limit, v_period_end, now())
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier, quota_limit = EXCLUDED.quota_limit,
    plan_period_end = EXCLUDED.plan_period_end, updated_at = now();

  RETURN QUERY SELECT p_tier, v_period_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_tier(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE VIEW public.admin_payments AS
SELECT p.id, p.user_id, p.razorpay_order_id, p.razorpay_payment_id, p.amount,
       p.currency, p.status, p.tier_granted, p.period_end, p.created_at,
       (p.razorpay_order_id LIKE 'comp_%') AS is_comp
FROM public.payments p;

ALTER VIEW public.admin_payments SET (security_invoker = true);
GRANT SELECT ON public.admin_payments TO authenticated;

COMMIT;
