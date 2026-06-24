-- Migration: Free BYOK + Tier-Based Quota Update
-- ─────────────────────────────────────────────────────────────────────────────
-- Changes:
--   1. Default quota_limit for new users goes from 10 → 50 (free tier)
--   2. Existing free-tier users are bumped from 10 → 50
--   3. The BYOK (upsert_encrypted_api_key) tier check is removed — all users
--      can now store and use their own API key regardless of tier.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Update column default to 50 for new users
ALTER TABLE public.user_settings
  ALTER COLUMN quota_limit SET DEFAULT 50;

-- 2. Bump existing free-tier rows that still have the old default of 10
UPDATE public.user_settings
  SET quota_limit = 50
  WHERE (tier IS NULL OR tier = 'free') AND quota_limit = 10;

-- 3. Replace upsert_encrypted_api_key without the TIER_REQUIRED check
--    so any authenticated user can store their own API key.
--    NOTE: The function body below preserves all existing behaviour except
--    the tier gate (lines that did: IF tier = 'free' THEN RAISE EXCEPTION 'TIER_REQUIRED').
CREATE OR REPLACE FUNCTION public.upsert_encrypted_api_key(
  p_api_key TEXT,
  p_api_provider TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_user_id UUID;
  v_key_id  UUID;
  v_encrypted BYTEA;
BEGIN
  -- Caller must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate provider
  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be openai, anthropic, or openrouter';
  END IF;

  -- NOTE: BYOK is no longer gated behind a paid tier.
  -- All authenticated users may store their own API key.

  -- Get (or create) the encryption key
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

  -- Upsert into user_settings.
  -- IMPORTANT: the column is `api_key_enc` and stores the ciphertext as a
  -- base64-encoded TEXT value. get_decrypted_api_key() reads this column and
  -- does decode(api_key_enc, 'base64') before decrypting, so the encode() here
  -- MUST stay in sync with that. (A previous revision of this migration wrote
  -- a raw BYTEA to a non-existent `encrypted_api_key` column, which made every
  -- save fail and broke BYOK generation.)
  INSERT INTO public.user_settings (user_id, api_key_enc, api_provider, updated_at)
    VALUES (v_user_id, encode(v_encrypted, 'base64'), p_api_provider, now())
  ON CONFLICT (user_id) DO UPDATE
    SET api_key_enc  = EXCLUDED.api_key_enc,
        api_provider = EXCLUDED.api_provider,
        updated_at   = now();
END;
$$;

-- Keep existing grants intact
GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT) TO authenticated;
