-- WRITTEN, NOT APPLIED. Requires owner approval.
--
-- Per-provider key store for post schedulers (Buffer, Hootsuite). Separate from
-- user_settings, which holds a single LLM key per user. Encryption reuses the
-- exact existing primitive: pgsodium.crypto_aead_det_encrypt with the
-- 'user_api_key_key' key, empty associated data, stored as base64 text.

CREATE TABLE IF NOT EXISTS public.scheduler_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN ('buffer', 'hootsuite')),
  api_key_enc text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.scheduler_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduler_api_keys_select_own ON public.scheduler_api_keys
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY scheduler_api_keys_insert_own ON public.scheduler_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scheduler_api_keys_update_own ON public.scheduler_api_keys
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scheduler_api_keys_delete_own ON public.scheduler_api_keys
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Table privileges: nothing for anon/public. Authenticated may only read the
-- non-secret columns and delete their own rows; writes of the secret column go
-- through upsert_scheduler_api_key (security definer), so ciphertext is never
-- readable or directly writable from the client.
REVOKE ALL ON public.scheduler_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, provider, created_at, updated_at) ON public.scheduler_api_keys TO authenticated;
GRANT DELETE ON public.scheduler_api_keys TO authenticated;
GRANT ALL ON public.scheduler_api_keys TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_scheduler_api_key(
  p_provider text,
  p_api_key  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_user_id   uuid;
  v_key_id    uuid;
  v_encrypted bytea;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_provider NOT IN ('buffer', 'hootsuite') THEN
    RAISE EXCEPTION 'Invalid provider';
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

  INSERT INTO public.scheduler_api_keys (user_id, provider, api_key_enc, updated_at)
    VALUES (v_user_id, p_provider, encode(v_encrypted, 'base64'), now())
  ON CONFLICT (user_id, provider) DO UPDATE
    SET api_key_enc = EXCLUDED.api_key_enc,
        updated_at  = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_scheduler_api_key(p_provider text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_user_id          uuid;
  v_key_id           uuid;
  v_encrypted_base64 text;
  v_decrypted        bytea;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_provider NOT IN ('buffer', 'hootsuite') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  SELECT api_key_enc INTO v_encrypted_base64
  FROM public.scheduler_api_keys
  WHERE user_id = v_user_id AND provider = p_provider;

  IF v_encrypted_base64 IS NULL THEN
    RETURN NULL;
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

  RETURN convert_from(v_decrypted, 'utf8');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_scheduler_api_key(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.upsert_scheduler_api_key(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_scheduler_api_key(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_scheduler_api_key(text) TO authenticated;
