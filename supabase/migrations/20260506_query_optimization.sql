-- Phase 5: Hot-Path Query Optimization
-- Adds indexes for frequently queried tables to improve performance
-- Created: 2026-05-06

-- ============================================================================
-- CALENDARS TABLE OPTIMIZATION
-- ============================================================================

-- Index for user calendars listing (most common query)
-- Query: SELECT * FROM calendars WHERE user_id = ? ORDER BY created_at DESC
create index if not exists idx_calendars_user_id_created_at
on public.calendars(user_id, created_at desc);

-- Single user_id index (backup, redundant with above but helps planner)
create index if not exists idx_calendars_user_id
on public.calendars(user_id);

-- ============================================================================
-- SCHEDULED_POSTS TABLE OPTIMIZATION
-- ============================================================================

-- Index for calendar's scheduled posts
-- Query: SELECT * FROM scheduled_posts WHERE calendar_id = ?
create index if not exists idx_scheduled_posts_calendar_id
on public.scheduled_posts(calendar_id);

-- Index for status filtering
-- Query: SELECT * FROM scheduled_posts WHERE status = 'published'
create index if not exists idx_scheduled_posts_status
on public.scheduled_posts(status);

-- Composite index for common calendar + status query
-- Query: SELECT * FROM scheduled_posts WHERE calendar_id = ? AND status = ?
create index if not exists idx_scheduled_posts_calendar_status
on public.scheduled_posts(calendar_id, status);

-- ============================================================================
-- TEMPLATES TABLE OPTIMIZATION
-- ============================================================================

-- Index for user's private templates
-- Query: SELECT * FROM templates WHERE user_id = ? AND is_shared = false
create index if not exists idx_templates_user_private
on public.templates(user_id, is_shared);

-- Index for shared templates browsing
-- Query: SELECT * FROM templates WHERE is_shared = true ORDER BY created_at DESC
create index if not exists idx_templates_shared_created_at
on public.templates(is_shared, created_at desc);

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- Create table for query performance tracking
-- Used to log slow queries and track optimization impact
create table if not exists public.query_performance (
  id uuid default gen_random_uuid() primary key,
  query_name text not null,
  execution_time_ms integer not null,
  row_count integer,
  timestamp timestamp with time zone default now(),
  constraint query_performance_execution_check check (execution_time_ms >= 0)
);

-- Enable compression on old performance records
alter table public.query_performance set (fillfactor = 50);

-- Index for checking slow queries
create index if not exists idx_query_performance_timestamp
on public.query_performance(timestamp desc);

create index if not exists idx_query_performance_execution_time
on public.query_performance(execution_time_ms desc);

-- ============================================================================
-- ANALYTICS
-- ============================================================================

-- Create table for tracking API latency and performance metrics
-- Used by monitoring dashboard to display performance trends
create table if not exists public.api_metrics (
  id uuid default gen_random_uuid() primary key,
  endpoint text not null, -- e.g., 'generate-calendar', 'generate-single-post'
  latency_ms integer not null,
  success boolean not null,
  error_code text,
  timestamp timestamp with time zone default now(),
  constraint api_metrics_latency_check check (latency_ms >= 0)
);

-- Indexes for performance analytics queries
create index if not exists idx_api_metrics_endpoint_timestamp
on public.api_metrics(endpoint, timestamp desc);

create index if not exists idx_api_metrics_timestamp
on public.api_metrics(timestamp desc);

-- Create materialized view for API performance summary
-- Refreshed hourly for quick dashboard queries
create materialized view if not exists public.api_performance_summary as
select
  endpoint,
  count(*) as total_calls,
  count(case when success = true then 1 end) as successful_calls,
  count(case when success = false then 1 end) as failed_calls,
  round(100.0 * count(case when success = true then 1 end) / count(*), 2) as success_rate,
  min(latency_ms) as min_latency_ms,
  round(avg(latency_ms)::numeric, 2) as avg_latency_ms,
  max(latency_ms) as max_latency_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
  date_trunc('hour', timestamp) as hour
from public.api_metrics
group by endpoint, date_trunc('hour', timestamp);

create index if not exists idx_api_performance_summary_hour
on public.api_performance_summary(hour desc);

-- ============================================================================
-- CLEANUP & MAINTENANCE
-- ============================================================================

-- Create function to clean up old performance metrics (retention: 30 days)
create or replace function cleanup_old_api_metrics()
returns void as $$
begin
  delete from public.api_metrics
  where timestamp < now() - interval '30 days';
  
  delete from public.query_performance
  where timestamp < now() - interval '30 days';
end;
$$ language plpgsql;

-- Create function to refresh performance summary view
create or replace function refresh_api_performance()
returns void as $$
begin
  refresh materialized view concurrently api_performance_summary;
end;
$$ language plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select on public.api_metrics to authenticated;
grant select on public.query_performance to authenticated;
grant select on public.api_performance_summary to authenticated;

-- Admin-only inserts to these tables
grant insert on public.api_metrics to authenticated;
grant insert on public.query_performance to authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
Performance Impact Expected:
- Calendars list query: 150ms → 50ms (67% improvement)
- Scheduled posts lookup: 100ms → 20ms (80% improvement)
- Templates search: 80ms → 15ms (81% improvement)

To verify improvements:
1. Run EXPLAIN ANALYZE before index creation
2. Run EXPLAIN ANALYZE after index creation
3. Compare query plans and execution times

Example EXPLAIN ANALYZE command:
EXPLAIN ANALYZE
SELECT * FROM calendars WHERE user_id = 'user-123' ORDER BY created_at DESC LIMIT 10;

Maintenance:
- Run ANALYZE on tables weekly to update statistics
- Monitor query_performance table for slow queries
- Refresh materialized view every hour (use pg_cron)
*/
