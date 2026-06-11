-- 1) Prevent listing every file in the public 'avatars' bucket.
-- Public read via direct URL still works for storage objects regardless of this policy.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 2) Revoke EXECUTE on SECURITY DEFINER trigger helper functions from app roles.
-- These are only meant to be invoked by triggers, never directly by clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;