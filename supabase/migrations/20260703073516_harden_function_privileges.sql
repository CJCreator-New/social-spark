-- Security linter hardening:
-- - SECURITY DEFINER functions should not be executable by anon/public.
-- - SECURITY DEFINER functions must pin search_path so name resolution cannot
--   be influenced by caller-controlled schemas.

ALTER FUNCTION public.get_decrypted_api_key()
  SET search_path = public, pgsodium;

ALTER FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT, TEXT)
  SET search_path = public, pgsodium;

ALTER FUNCTION public.increment_generation_count(UUID)
  SET search_path = public;

ALTER FUNCTION public.grant_tier_from_payment(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, TEXT, INTEGER, TEXT)
  SET search_path = public;

ALTER FUNCTION public.is_admin()
  SET search_path = public;

ALTER FUNCTION public.admin_grant_tier(UUID, TEXT, INTEGER, INTEGER)
  SET search_path = public;

ALTER FUNCTION public.has_role(UUID, public.app_role)
  SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_encrypted_api_key(TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_generation_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_tier_from_payment(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tier_from_payment(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, TEXT, INTEGER, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_grant_tier(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_tier(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
