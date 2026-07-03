
-- 1) Harden increment_generation_count: require caller == p_user_id
CREATE OR REPLACE FUNCTION public.increment_generation_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.user_settings (user_id, generation_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET generation_count = public.user_settings.generation_count + 1
  RETURNING generation_count INTO new_count;
  RETURN new_count;
END;
$function$;

-- 2) Fix admin_users policy: don't trust JWT 'role' claim; use has_role/is_admin
DROP POLICY IF EXISTS "Super admin can manage admin users" ON public.admin_users;
CREATE POLICY "Super admin can manage admin users"
ON public.admin_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Pin search_path on get_decrypted_api_key (fixes function_search_path_mutable)
ALTER FUNCTION public.get_decrypted_api_key() SET search_path = public, pgsodium;

-- 4) Revoke default PUBLIC EXECUTE on SECURITY DEFINER functions; grant only where needed
REVOKE EXECUTE ON FUNCTION public.increment_generation_count(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.increment_generation_count(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_decrypted_api_key() TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_encrypted_api_key(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.upsert_encrypted_api_key(text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_grant_tier(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_grant_tier(uuid, text, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_tier_from_payment(uuid, text, integer, timestamptz, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_tier_from_payment(uuid, text, integer, timestamptz, text, text, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- handle_new_user runs as a trigger owned by postgres; no role needs EXECUTE
