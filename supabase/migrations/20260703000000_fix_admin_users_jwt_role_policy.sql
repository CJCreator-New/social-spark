-- Security fix: the "Super admin can manage admin users" policy on
-- public.admin_users checked auth.jwt() ->> 'role' = 'admin'. The JWT
-- `role` claim is the Postgres connection-pooling role (normally
-- 'authenticated'/'anon'), not an app-level admin flag — it is not a
-- claim this app controls or verifies, so relying on it here is either
-- always-false dead code or, if any Auth Hook ever sets custom claims,
-- forgeable by the client. Replace it with the same self-referential
-- admin_users membership check already used by the sibling SELECT policy.

drop policy if exists "Super admin can manage admin users" on public.admin_users;

create policy "Super admin can manage admin users"
  on public.admin_users
  for all
  using (
    auth.uid() in (
      select user_id from public.admin_users
    )
  )
  with check (
    auth.uid() in (
      select user_id from public.admin_users
    )
  );
