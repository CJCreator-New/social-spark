-- Queue jobs with retries
create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_queue_attempts_check check (attempts >= 0 and max_attempts >= 1)
);

alter table public.job_queue enable row level security;

create index if not exists idx_job_queue_status_next_attempt
  on public.job_queue(status, next_attempt_at);

create index if not exists idx_job_queue_lock_token
  on public.job_queue(lock_token);

create or replace function public.claim_next_job()
returns setof public.job_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.job_queue%rowtype;
begin
  update public.job_queue
    set status = 'processing',
        locked_at = now(),
        lock_token = gen_random_uuid(),
        updated_at = now()
  where id = (
    select id from public.job_queue
    where status = 'pending'
      and next_attempt_at <= now()
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  if found then
    return next claimed;
  end if;
  return;
end;
$$;

create policy "Service role can manage job queue"
  on public.job_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Telemetry events
create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  props jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.telemetry_events enable row level security;

create policy "Service role manages telemetry"
  on public.telemetry_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_telemetry_events_name_created
  on public.telemetry_events(event_name, created_at desc);

-- Media references tracked server-side for cleanup
create table if not exists public.media_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  public_url text not null,
  reference_kind text not null default 'avatar',
  reference_key text,
  reference_count integer not null default 1,
  last_referenced_at timestamptz not null default now(),
  orphaned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

alter table public.media_references enable row level security;

create policy "Users manage their media references"
  on public.media_references
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_media_references_user_orphaned
  on public.media_references(user_id, orphaned_at, deleted_at);

create index if not exists idx_media_references_public_url
  on public.media_references(public_url);

create or replace function public.cleanup_orphan_media_references(max_age interval default interval '24 hours')
returns setof public.media_references
language plpgsql
security definer
set search_path = public
as $$
declare
  orphan_row public.media_references%rowtype;
begin
  for orphan_row in
    select mr.*
    from public.media_references mr
    where mr.deleted_at is null
      and mr.reference_count <= 0
      and coalesce(mr.orphaned_at, mr.updated_at) < now() - max_age
      and not exists (
        select 1 from public.profiles p where p.avatar_url = mr.public_url
      )
      and not exists (
        select 1 from public.saved_calendars c
        where c.posts::text like '%' || mr.public_url || '%'
      )
  loop
    update public.media_references
      set deleted_at = now(), updated_at = now()
      where id = orphan_row.id
      returning * into orphan_row;
    return next orphan_row;
  end loop;
  return;
end;
$$;
