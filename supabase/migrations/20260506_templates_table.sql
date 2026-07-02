-- Phase 4: Templates Table Migration
-- Allows users to save and reuse form configurations as templates
-- Created: 2026-05-06
--
-- NOTE: 20260507053815_f3d13a7e-b5a1-4257-91c6-77fd89ce1f1e.sql also creates
-- `public.templates` (a narrower, non-shared version). This file is authoritative
-- — it created the table first, and the later migration was guarded in 2026-07-02
-- to no-op if the table already exists rather than erroring on replay.

-- Create templates table
create table public.templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Template metadata
  name text not null,
  description text,
  is_shared boolean default false,
  
  -- Template data (form configuration)
  config jsonb not null, -- Stores FormStep1-4 data
  
  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Indexes for query performance
  constraint templates_name_unique_per_user unique(user_id, name),
  constraint templates_name_length check(char_length(name) >= 1 and char_length(name) <= 200),
  constraint templates_description_length check(char_length(description) <= 1000)
);

-- Enable Row Level Security
alter table public.templates enable row level security;

-- RLS Policy: Users can only see their own templates or shared public ones
create policy "Users can view their own templates or public templates"
  on public.templates
  for select
  using (
    auth.uid() = user_id
    or is_shared = true
  );

-- RLS Policy: Users can only create templates for themselves
create policy "Users can create their own templates"
  on public.templates
  for insert
  with check (auth.uid() = user_id);

-- RLS Policy: Users can only update their own templates
create policy "Users can update their own templates"
  on public.templates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own templates
create policy "Users can delete their own templates"
  on public.templates
  for delete
  using (auth.uid() = user_id);

-- Create indexes for performance
create index idx_templates_user_id on public.templates(user_id);
create index idx_templates_user_id_created_at on public.templates(user_id, created_at desc);
create index idx_templates_is_shared on public.templates(is_shared);
create index idx_templates_created_at on public.templates(created_at desc);

-- Create trigger to auto-update updated_at
create or replace function update_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_templates_updated_at_trigger
before update on public.templates
for each row
execute function update_templates_updated_at();

-- Add grant permissions for authenticated users
grant select, insert, update, delete on public.templates to authenticated;
grant usage on sequence templates_id_seq to authenticated;

-- Create shared_templates view for browsing public templates
create view public.shared_templates as
select
  id,
  user_id,
  name,
  description,
  config,
  created_at,
  updated_at
from public.templates
where is_shared = true
order by created_at desc;

-- Grant permission to view shared templates
grant select on public.shared_templates to authenticated;
