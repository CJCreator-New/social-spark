ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS key_mode TEXT NOT NULL DEFAULT 'fallback' CHECK (key_mode IN ('fallback', 'always'));

CREATE OR REPLACE FUNCTION public.get_decrypted_api_key()
RETURNS TABLE (
	decrypted_key TEXT,
	api_provider TEXT,
	use_own_key BOOLEAN,
	key_mode TEXT
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
	v_decrypted BYTEA;
BEGIN
	v_user_id := auth.uid();
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT api_key_enc, api_provider, use_own_key, key_mode
	INTO v_encrypted_base64, v_provider, v_use_own_key, v_key_mode
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

	RETURN QUERY SELECT convert_from(v_decrypted, 'utf8'), v_provider, COALESCE(v_use_own_key, false), COALESCE(v_key_mode, 'fallback');
END;
$$;
