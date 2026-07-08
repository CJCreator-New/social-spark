# Complete the Live AI Generation Fix

Verified against the live database — three backend pieces from the previous plan are still missing, which is why generation is still falling back to the local template.

## Evidence

1. **`get_decrypted_api_key` — no EXECUTE grant**
   `has_function_privilege` check returned `auth_exec:false, anon_exec:false, svc_exec:true`. BYOK decryption still fails with 42501 for logged-in users; the waterfall then falls back to the shared gateway (or to local generation when that also errors).

2. **`telemetry_events` table — missing**
   `information_schema.tables` returns no row for `public.telemetry_events`. The `telemetry` function keeps logging `PGRST205 Could not find the table 'public.telemetry_events' in the schema cache`.

3. **`rate_limit_events` table — missing**
   `supabase/functions/_shared/promptHelpers.ts` was already rewritten to query `public.rate_limit_events` (lines 768–830), but the table doesn't exist. Every rate-limit check now throws → the catch returns `allowed: true`, but the deployed function still has the old `Deno.openKv` code path. Either way, rate limiting is not working.

## Fix

### Step 1 — One migration for the three DB gaps

```sql
-- (a) Grant EXECUTE on get_decrypted_api_key to authenticated
REVOKE ALL ON FUNCTION public.get_decrypted_api_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_decrypted_api_key() TO authenticated, service_role;

-- (b) Rate limit events table (used by checkRateLimit)
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,           -- text so we can key by IP for anon telemetry
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, endpoint, created_at DESC);

GRANT ALL ON public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- Service-role only; no policies for anon/authenticated (edge fn uses SR key).

-- (c) Telemetry events table
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
```

### Step 2 — Redeploy affected edge functions

Deploy so the freshly-granted RPC and the rewritten `checkRateLimit` are actually running:
`generate-calendar`, `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `generate-post-image`, `generate-trends`, `extract-ideas`, `decrypt-api-key`, `encrypt-api-key`, `telemetry`.

### Step 3 — Verify

- `curl_edge_functions` on `decrypt-api-key` as the preview user → expect 200 with `hasKey`, no 42501 in logs.
- Trigger a calendar generation from the UI → confirm no "local fallback" banner and a `telemetry_events` row appears.
- Fire 12 rapid `extract-ideas` calls (limit 10/min) → confirm a 429 on the 11th.

## Scope
- One SQL migration.
- No code changes (helpers and telemetry function already match the new schema).
- No UI changes.

Approve to switch to build mode and apply the migration + redeploys.