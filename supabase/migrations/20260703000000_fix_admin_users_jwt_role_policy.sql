-- Security fix: the "Super admin can manage admin users" policy previously
-- relied on a token claim instead of the app's server-side role table.
-- Replace it with the same verified role helper used elsewhere in the app.

drop policy if exists "Super admin can manage admin users" on public.admin_users;

create policy "Super admin can manage admin users"
  on public.admin_users
  for all
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );
