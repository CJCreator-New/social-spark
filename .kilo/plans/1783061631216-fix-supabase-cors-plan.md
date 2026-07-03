# Fix CORS errors on Supabase edge functions

## Root cause

The Vite dev server at `http://localhost:5175` calls the production Supabase edge functions (`https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/...`) directly. The browser sends a CORS preflight OPTIONS request. In `supabase/functions/_shared/promptHelpers.ts:10-14`, the code throws at **module load time** when `DENO_DEPLOYMENT_ID` is set (production) but `ALLOWED_ORIGIN` is missing. That crashes the function before it can respond to the preflight, so the browser sees a non-200 status and blocks the request.

## Tasks

### 1. Add Vite dev-server proxy (eliminates CORS in development)

**File:** `vite.config.ts`

Add a `server.proxy` rule that proxies `/functions/v1/*` to `https://mbxlvsftyifovbkpsvyw.supabase.co`. Forward all relevant headers (`Authorization`, `apikey`, `Content-Type`, etc.) transparently. The browser will see the requests as same-origin, so CORS is bypassed entirely during local development.

### 2. Set `ALLOWED_ORIGIN` in Supabase Edge Functions secrets (fixes production CORS)

In the Supabase Dashboard → Edge Functions → Secrets, set `ALLOWED_ORIGIN` to the production frontend domain. This makes the production CORS check pass correctly for real users.

### 3. Harden `promptHelpers.ts` to fail gracefully instead of crashing

**File:** `supabase/functions/_shared/promptHelpers.ts`

Replace the module-load `throw new Error(...)` (lines 12-14) with a runtime check that:
- In production (`DENO_DEPLOYMENT_ID` set): returns empty CORS headers and logs a warning if `ALLOWED_ORIGIN` is missing, instead of crashing the entire function.
- In local dev: returns `*` as before.

This prevents the function from becoming completely unreachable if the secret is accidentally removed.

### 4. Update import sites to use new CORS helper

**Files:**
- `supabase/functions/encrypt-api-key/index.ts`
- `supabase/functions/decrypt-api-key/index.ts`
- `supabase/functions/health/index.ts`
- Any other function that imports `corsHeaders`

Change from using the static `corsHeaders` constant to calling a new `getCorsHeaders(req.headers.get("origin"))` function so the `Access-Control-Allow-Origin` header is set dynamically per request based on the incoming origin and `ALLOWED_ORIGIN` config.
