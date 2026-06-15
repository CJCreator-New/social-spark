-- Fix: authenticated users could not save or retrieve their API keys because
-- the SECURITY DEFINER RPCs created in 20260609123000_user_settings.sql were
-- never granted EXECUTE to the authenticated role (Supabase revokes the
-- default PUBLIC execute privilege on new functions).

GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated;
