-- F-022: this is the AUTHORITATIVE current grant state for the BYOK RPCs.
-- 20260703073516_harden_function_privileges.sql and
-- 20260703080952_...sql also touch these grants, but this migration is the
-- one that actually reflects reality on every environment — treat it as the
-- source of truth for "what is currently granted" and leave the earlier two
-- in place only as historical record; do not try to reconcile by editing them.
--
-- Self-healing repair for the BYOK RPC drift described in the audit:
-- 20260703080952 revoked `authenticated` EXECUTE on get_decrypted_api_key()
-- and tried to REVOKE/GRANT the already-dropped 2-arg upsert_encrypted_api_key
-- overload, which errors on a database where that overload no longer exists
-- and rolls back the whole statement batch. This migration is idempotent and
-- re-asserts the correct end state regardless of which of the prior BYOK
-- migrations actually landed on a given environment.

DO $$
BEGIN
  -- Drop the legacy 2-arg overload if it still exists anywhere.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_encrypted_api_key'
      AND pg_get_function_identity_arguments(p.oid) = 'p_api_key text, p_api_provider text'
  ) THEN
    DROP FUNCTION public.upsert_encrypted_api_key(text, text);
  END IF;
END $$;

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
SET search_path = public, pgsodium
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter', 'gemini', 'kimi', 'glm') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be one of: openai, anthropic, openrouter, gemini, kimi, glm';
  END IF;

  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    INSERT INTO pgsodium.key (name) VALUES ('user_api_key_key') RETURNING id INTO v_key_id;
  END IF;

  v_encrypted := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_api_key, 'utf8'),
    ''::bytea,
    v_key_id
  );

  INSERT INTO public.user_settings (user_id, api_key_enc, api_provider, api_model, updated_at)
    VALUES (v_user_id, encode(v_encrypted, 'base64'), p_api_provider, p_api_model, now())
  ON CONFLICT (user_id) DO UPDATE
    SET api_key_enc  = EXCLUDED.api_key_enc,
        api_provider = EXCLUDED.api_provider,
        api_model    = COALESCE(EXCLUDED.api_model, public.user_settings.api_model),
        updated_at   = now();
END;
$$;

-- Final grant state: decrypt-api-key/index.ts and encrypt-api-key/index.ts both
-- call these RPCs via a user-context client (caller's own JWT), so `authenticated`
-- must retain EXECUTE. service_role is also granted for any server-side tooling.
REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_encrypted_api_key(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.upsert_encrypted_api_key(text, text, text) TO authenticated, service_role;
