
-- (a) Grants for BYOK decryption RPC
REVOKE ALL ON FUNCTION public.get_decrypted_api_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_decrypted_api_key() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO service_role;

-- (b) rate_limit_events
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, endpoint, created_at DESC);

GRANT ALL ON public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) touch this table.

-- (c) telemetry_events
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
  ON public.telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user
  ON public.telemetry_events (user_id, created_at DESC);

GRANT ALL ON public.telemetry_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.telemetry_events_id_seq TO service_role;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (public.is_admin());
