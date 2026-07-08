-- Fix Live AI Generation Pipeline Issues
-- 1. Grant execute privileges on public.get_decrypted_api_key()
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key() FROM anon, public;

-- 2. Restore/Re-create telemetry_events table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  props jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all telemetry" ON public.telemetry_events;
CREATE POLICY "Admins can view all telemetry"
  ON public.telemetry_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role manages telemetry" ON public.telemetry_events;
CREATE POLICY "Service role manages telemetry"
  ON public.telemetry_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_created
  ON public.telemetry_events(event_name, created_at desc);

GRANT INSERT ON public.telemetry_events TO authenticated, service_role;
GRANT SELECT ON public.telemetry_events TO authenticated, service_role;

-- 3. Create rate_limit_events table
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_events;
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limit_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_query
  ON public.rate_limit_events (user_id, endpoint, created_at desc);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at
  ON public.rate_limit_events (created_at);

GRANT ALL ON public.rate_limit_events TO service_role;
GRANT INSERT, SELECT ON public.rate_limit_events TO authenticated;
