-- Store structured feedback for regenerate-with-feedback events.
create table if not exists public.regenerate_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  calendar_id uuid references public.saved_calendars(id) on delete cascade,
  day integer not null,
  dow text not null,
  platform text,
  category text,
  rating integer,
  feedback text not null,
  tweak text,
  created_at timestamptz not null default now(),
  constraint regenerate_feedback_rating_check check (rating is null or (rating >= 1 and rating <= 5))
);

alter table public.regenerate_feedback enable row level security;

create policy "Service role manages regenerate feedback"
  on public.regenerate_feedback
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_regenerate_feedback_calendar_created
  on public.regenerate_feedback(calendar_id, created_at desc);

create index if not exists idx_regenerate_feedback_user_created
  on public.regenerate_feedback(user_id, created_at desc);
