-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  api_key_enc TEXT,
  api_provider TEXT NOT NULL DEFAULT 'openai' CHECK (api_provider IN ('openai', 'anthropic', 'openrouter')),
  use_own_key BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users can view own user settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create encryption key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE name = 'user_api_key_key') THEN
    PERFORM pgsodium.create_key(name := 'user_api_key_key');
  END IF;
END $$;

-- RPC to encrypt and upsert user API key
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_api_provider NOT IN ('openai', 'anthropic', 'openrouter') THEN
    RAISE EXCEPTION 'Invalid api_provider. Must be openai, anthropic, or openrouter';
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

-- RPC to decrypt and retrieve user API key
CREATE OR REPLACE FUNCTION public.get_decrypted_api_key()
RETURNS TABLE (
  decrypted_key TEXT,
  api_provider TEXT
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
  v_decrypted BYTEA;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the encrypted key and provider from user_settings
  SELECT api_key_enc, user_settings.api_provider INTO v_encrypted_base64, v_provider
  FROM public.user_settings
  WHERE user_id = v_user_id;

  IF v_encrypted_base64 IS NULL THEN
    RETURN;
  END IF;

  -- Get key ID for decryption
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'user_api_key_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Decrypt using pgsodium
  BEGIN
    v_decrypted := pgsodium.crypto_aead_det_decrypt(
      decode(v_encrypted_base64, 'base64'),
      ''::bytea,
      v_key_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption failed';
  END;

  RETURN QUERY SELECT convert_from(v_decrypted, 'utf8'), v_provider;
END;
$$;
