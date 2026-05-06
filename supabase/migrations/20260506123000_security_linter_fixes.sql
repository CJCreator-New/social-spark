-- Tighten storage listing and function execution privileges flagged by Supabase lint.

drop policy if exists "Avatar images are publicly accessible" on storage.objects;

create policy "Users can list own avatars"
on storage.objects for select
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.cleanup_old_api_metrics() from anon, authenticated;
revoke execute on function public.refresh_api_performance() from anon, authenticated;
revoke execute on function public.cleanup_old_rate_limits() from anon, authenticated;
revoke execute on function public.refresh_rate_limit_stats() from anon, authenticated;

-- Keep public.has_role(uuid, public.app_role) callable; RLS policies and admin UI depend on it.
