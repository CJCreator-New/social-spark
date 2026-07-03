-- ─────────────────────────────────────────────────────────────────────────────
-- BYOK: new providers (gemini, kimi, glm) + per-user model selection
--
-- 1. Add nullable user_settings.api_model — persists the user's chosen model
--    id per provider. NULL means "use the provider default" (getProviderModel
--    in promptHelpers.ts), so existing rows keep working unchanged.
-- 2. Widen the api_provider CHECK constraint to allow the 3 new providers.
-- 3. Re-create get_decrypted_api_key() and upsert_encrypted_api_key() as
--    CREATE OR REPLACE with the full desired body, so this migration is
--    idempotent and self-repairing regardless of which prior version
--    (2-column vs 4-column get_decrypted_api_key) is actually live.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS api_model TEXT;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_api_provider_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_api_provider_check
  CHECK (api_provider IN ('openai', 'anthropic', 'openrouter', 'gemini', 'kimi', 'glm'));

CREATE OR REPLACE FUNCTION public.get_decrypted_api_key()
RETURNS TABLE (
	decrypted_key TEXT,
	api_provider TEXT,
	use_own_key BOOLEAN,
	key_mode TEXT,
	api_model TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
	v_user_id UUID;
	v_key_id UUID;
	v_encrypted_base64 TEXT;
	v_provider TEXT;
	v_use_own_key BOOLEAN := false;
	v_key_mode TEXT := 'fallback';
	v_api_model TEXT;
	v_decrypted BYTEA;
BEGIN
	v_user_id := auth.uid();
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT api_key_enc, api_provider, use_own_key, key_mode, api_model
	INTO v_encrypted_base64, v_provider, v_use_own_key, v_key_mode, v_api_model
	FROM public.user_settings
	WHERE user_id = v_user_id;

	IF v_encrypted_base64 IS NULL THEN
		RETURN;
	END IF;

	SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
	IF v_key_id IS NULL THEN
		RAISE EXCEPTION 'Encryption key not found';
	END IF;

	BEGIN
		v_decrypted := pgsodium.crypto_aead_det_decrypt(
			decode(v_encrypted_base64, 'base64'),
			''::bytea,
			v_key_id
		);
	EXCEPTION WHEN OTHERS THEN
		RAISE EXCEPTION 'Decryption failed';
	END;

	RETURN QUERY SELECT
		convert_from(v_decrypted, 'utf8'),
		v_provider,
		COALESCE(v_use_own_key, false),
		COALESCE(v_key_mode, 'fallback'),
		v_api_model;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated;

-- The new signature adds a third parameter, which Postgres treats as a
-- distinct overload rather than a replacement of the existing (TEXT, TEXT)
-- function. Drop the old overload explicitly so callers can't accidentally
-- resolve to a version that doesn't know about the expanded provider list.
DROP FUNCTION IF EXISTS public.upsert_encrypted_api_key(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_encrypted_api_key(
  p_api_key TEXT,
  p_api_provider TEXT,
  p_api_model TEXT DEFAULT NULL
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
  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter', 'gemini', 'kimi', 'glm') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be one of: openai, anthropic, openrouter, gemini, kimi, glm';
  END IF;

  -- BYOK is not gated behind a paid tier; all authenticated users may store
  -- their own API key.

  -- Get (or create) the encryption key
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    INSERT INTO pgsodium.key (name) VALUES ('user_api_key_key') RETURNING id INTO v_key_id;
  END IF;

  v_encrypted := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_api_key, 'utf8'),
    ''::bytea,
    v_key_id
  );

  -- api_key_enc is stored as a base64-encoded TEXT value; get_decrypted_api_key()
  -- does decode(api_key_enc, 'base64') before decrypting, so this MUST stay in sync.
  INSERT INTO public.user_settings (user_id, api_key_enc, api_provider, api_model, updated_at)
    VALUES (v_user_id, encode(v_encrypted, 'base64'), p_api_provider, p_api_model, now())
  ON CONFLICT (user_id) DO UPDATE
    SET api_key_enc  = EXCLUDED.api_key_enc,
        api_provider = EXCLUDED.api_provider,
        api_model    = COALESCE(EXCLUDED.api_model, public.user_settings.api_model),
        updated_at   = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT, TEXT) TO authenticated;
