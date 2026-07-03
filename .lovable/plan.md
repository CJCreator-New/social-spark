# Fix production CORS blocks

## Root cause

Both failing endpoints reject the preflight because the production origin `https://contentforged.lovable.app` is not in their allow-lists:

1. **`telemetry`** — has a hardcoded `ALLOWED_ORIGINS` set in `supabase/functions/telemetry/index.ts` that only contains `contentforged.lovable.app`… wait, it does — but the deployed copy is the older `dashboard-deploy/telemetry.ts` variant, and neither includes the `id-preview--*.lovable.app` preview origin. When origin isn't in the set, the function returns no `Access-Control-Allow-Origin` header at all, so the browser fails the preflight.
2. **`decrypt-api-key`** — uses `getCorsHeaders()` from `_shared/promptHelpers.ts`, which reads the `ALLOWED_ORIGIN` Supabase secret. That secret is either unset or doesn't include `https://contentforged.lovable.app`, so `resolveAllowedOrigin()` returns `""` and the preflight fails.

Same failure mode also affects any other function using `getCorsHeaders` (encrypt-api-key, delete-api-key, health, generate-*, etc.) whenever called from the published domain.

## Fix

### 1. Set the `ALLOWED_ORIGIN` edge-function secret

Add (or update) the Supabase Edge Functions secret `ALLOWED_ORIGIN` to a comma-separated list covering every origin the app is served from:

```
https://contentforged.lovable.app,https://id-preview--b31b4522-b054-4b2f-ac2d-d7f2a2953cef.lovable.app,http://localhost:5173,http://localhost:8080
```

This immediately unblocks `decrypt-api-key`, `encrypt-api-key`, `delete-api-key`, `health`, and all generate/regenerate functions on the published domain, without any code change.

### 2. Update `telemetry` allow-list to include the preview host

Edit `supabase/functions/telemetry/index.ts` (and the mirrored `dashboard-deploy/telemetry.ts`) to accept the Lovable preview subdomain in addition to the current entries. Simplest robust approach: keep the exact set for prod + localhost, and also allow any `https://*.lovable.app` origin via a regex check inside `corsHeadersFor`.

### 3. Make OPTIONS explicitly return 204 with CORS headers even on unknown origins

In both `telemetry` and `getCorsHeaders`, when the origin isn't allowed, still return a valid preflight response (status 204 with `Access-Control-Allow-Headers` set) rather than a header-less `null` body. This prevents the "It does not have HTTP ok status" browser message and makes misconfiguration diagnosable via a proper 403 on the actual POST instead of a confusing preflight failure.

### 4. Verify

After deploy:
- Load `/app`, trigger a generation, confirm no CORS errors in console.
- `curl -i -X OPTIONS https://<project>.supabase.co/functions/v1/decrypt-api-key -H "Origin: https://contentforged.lovable.app" -H "Access-Control-Request-Method: POST"` → expect `Access-Control-Allow-Origin: https://contentforged.lovable.app`.

## Technical details

- Files edited: `supabase/functions/telemetry/index.ts`, `supabase/functions/_shared/promptHelpers.ts`, `dashboard-deploy/telemetry.ts`.
- Secret set: `ALLOWED_ORIGIN` (via `add_secret`).
- No frontend changes required; no database migration.
