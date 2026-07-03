-- Phase 5: Admin Users Table
-- Tracks which users have admin dashboard access
-- Created: 2026-05-06

create table if not exists public.admin_users (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  notes text
);

-- Enable Row Level Security
alter table public.admin_users enable row level security;

-- RLS Policy: Only admins can view admin users list
create policy "Admins can view admin users list"
  on public.admin_users
  for select
  using (
    auth.uid() in (
      select user_id from public.admin_users
    )
  );

-- RLS Policy: Only app admins can manage admins
create policy "Super admin can manage admin users"
  on public.admin_users
  for all
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Grant permissions
grant select on public.admin_users to authenticated;
grant insert, update, delete on public.admin_users to authenticated;

-- Create index for fast admin lookups
create index idx_admin_users_user_id on public.admin_users(user_id);
create index idx_admin_users_created_at on public.admin_users(created_at);

-- Comment for documentation
comment on table public.admin_users is
'Tracks users with admin dashboard access. Add a user to this table to give them admin privileges.
See pages/Admin.tsx and lib/admin.ts for dashboard implementation.';
