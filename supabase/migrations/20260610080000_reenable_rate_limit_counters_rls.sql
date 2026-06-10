-- Re-enable Row Level Security on rate_limit_counters
-- The previous migration (20260506_rate_limit_counters.sql) disabled RLS
-- immediately after enabling it, leaving the table fully exposed.
-- Created: 2026-06-10

alter table public.rate_limit_counters enable row level security;

-- Users can only view their own rate limit rows.
DO $$ BEGIN
  CREATE POLICY "Users can view their own rate limit data"
    ON public.rate_limit_counters
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can insert their own rate limit rows (for client-tracked usage).
DO $$ BEGIN
  CREATE POLICY "Users can insert their own rate limit data"
    ON public.rate_limit_counters
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role (edge functions) can manage all rows for cross-user rate limiting.
DO $$ BEGIN
  CREATE POLICY "Service role manages rate limit data"
    ON public.rate_limit_counters
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
