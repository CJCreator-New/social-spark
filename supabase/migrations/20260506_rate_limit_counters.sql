-- Phase 5: Rate Limit Counters Table
-- Stores rate limit usage for cross-invocation tracking
-- Created: 2026-05-06

create table public.rate_limit_counters (
  id uuid default gen_random_uuid() primary key,
  key text not null, -- Format: "endpoint:user_id"
  endpoint text not null,
  user_id uuid references auth.users(id) on delete cascade,
  
  -- Request metadata
  used_at timestamp with time zone not null,
  request_duration_ms integer,
  success boolean not null default true,
  
  -- TTL: Delete after 24 hours
  created_at timestamp with time zone default now(),
  constraint rate_limit_counters_duration_check check (request_duration_ms is null or request_duration_ms >= 0)
);

-- Enable compression for time-series data
alter table public.rate_limit_counters set (fillfactor = 50);

-- Indexes for fast lookups
create index idx_rate_limit_counters_key
on public.rate_limit_counters(key);

create index idx_rate_limit_counters_key_used_at
on public.rate_limit_counters(key, used_at desc);

create index idx_rate_limit_counters_endpoint
on public.rate_limit_counters(endpoint);

create index idx_rate_limit_counters_user_id
on public.rate_limit_counters(user_id);

-- Index for cleanup queries (remove old entries)
create index idx_rate_limit_counters_created_at
on public.rate_limit_counters(created_at);

-- Materialized view for rate limit statistics
create materialized view if not exists public.rate_limit_stats as
select
  endpoint,
  user_id,
  count(*) as total_requests,
  count(case when success = true then 1 end) as successful_requests,
  count(case when success = false then 1 end) as failed_requests,
  round(100.0 * count(case when success = true then 1 end) / count(*), 2) as success_rate,
  round(avg(request_duration_ms)::numeric, 2) as avg_duration_ms,
  max(request_duration_ms) as max_duration_ms,
  max(used_at) as last_request_at,
  date_trunc('hour', max(used_at)) as last_hour
from public.rate_limit_counters
group by endpoint, user_id;

create index idx_rate_limit_stats_endpoint
on public.rate_limit_stats(endpoint);

-- Enable Row Level Security (optional - admins can see all)
alter table public.rate_limit_counters enable row level security;

-- RLS Policy: Users can only see their own rate limit data (for debugging)
create policy "Users can view their own rate limit data"
  on public.rate_limit_counters
  for select
  using (auth.uid() = user_id);

-- Policy: Service role can insert (for tracking)
-- NOTE: Superseded by 20260610080000_reenable_rate_limit_counters_rls.sql, which re-enables RLS on this table.
alter table public.rate_limit_counters disable row level security;

-- Grants
grant select on public.rate_limit_counters to authenticated;
grant insert on public.rate_limit_counters to authenticated;
grant select on public.rate_limit_stats to authenticated;

-- Create function to clean up old rate limit records (retention: 24 hours)
create or replace function cleanup_old_rate_limits()
returns void as $$
begin
  delete from public.rate_limit_counters
  where created_at < now() - interval '24 hours';
end;
$$ language plpgsql;

-- Create function to refresh rate limit stats view
create or replace function refresh_rate_limit_stats()
returns void as $$
begin
  refresh materialized view concurrently rate_limit_stats;
end;
$$ language plpgsql;

-- Comment for documentation
comment on table public.rate_limit_counters is 
'Tracks API requests for rate limiting. Enables hybrid KV + DB rate limiting.
Records are automatically cleaned up after 24 hours.
See lib/rateLimiting.ts for service implementation.';

comment on materialized view public.rate_limit_stats is
'Materialized view for rate limit statistics. Refresh periodically using refresh_rate_limit_stats().
Used for monitoring dashboard and rate limit analysis.';
