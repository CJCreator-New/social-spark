# Dashboard Deploy — Edge Functions (paste-ready)

These are **auto-generated, self-contained** copies of the Supabase edge functions
with all `../_shared` imports inlined, so they can be pasted directly into the
**Supabase Dashboard → Edge Functions** editor (which doesn't support multi-file
functions / `_shared`).

> ⚠️ **Do not edit these files by hand.** The source of truth is
> `supabase/functions/<name>/index.ts`. Regenerate after any change:
> ```
> node scripts/inline-edge-functions.mjs
> ```

## Why this exists
This project is Lovable-managed and does **not** auto-deploy Supabase edge
functions (confirmed: the functions returned HTTP 404 in production). Lovable
deploys the frontend from `main`; the DB migrations were applied manually via the
SQL Editor; these functions must be deployed manually too.

---

## Step 1 — Set function secrets (once)

Dashboard → **Edge Functions → Manage secrets** (or Project Settings → Edge
Functions). These are shared by all functions. Most already exist; add the
Razorpay ones:

| Secret | Value | Needed by |
|--------|-------|-----------|
| `RAZORPAY_KEY_ID` | `rzp_test_T1opoMcfX5k0nB` (test) | create-order, verify-payment |
| `RAZORPAY_KEY_SECRET` | `e3jCiRC4FrSLlKcACSolcU0h` (test) | create-order, verify-payment |
| `SUPABASE_URL` | (auto-provided) | most |
| `SUPABASE_ANON_KEY` | (auto-provided) | most |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto-provided) | verify-payment, encrypt/decrypt/delete-api-key |
| `LOVABLE_API_KEY` | (your existing AI gateway key) | generate-*, regenerate, repurpose, inline-rewrite |

> For go-live, swap `RAZORPAY_*` to your **live** keys.

## Step 2 — Create each function

For every file in this folder (except this README):

1. Dashboard → **Edge Functions → Create a new function**.
2. Name it **exactly** the filename without `.ts` (e.g. `create-order`).
3. Delete the starter code, paste the **entire** contents of the file.
4. **Set "Verify JWT" per the table below**, then Deploy.

### ⚠️ Verify JWT setting (critical)

These functions do their **own** auth (`supabase.auth.getUser()`), so the
platform JWT gate must be **OFF**, or requests (incl. the app's) get rejected:

**Verify JWT = OFF** (turn the toggle off):
`create-order`, `verify-payment`, `encrypt-api-key`, `decrypt-api-key`,
`delete-api-key`, `generate-calendar`, `generate-single-post`,
`regenerate-post`, `generate-trends`, `telemetry`, `queue-worker`,
`cleanup-media`

**Verify JWT = ON** (default; leave on):
`generate-post-image`, `repurpose-post`, `inline-rewrite`, `trends_ingest`,
`trends_read`

> Source: `supabase/config.toml`. If a function misbehaves with 401s, check this
> toggle first.

## Step 3 — Priority order (deploy the beta-critical ones first)

You don't have to do all 17 at once. To unblock the paid beta:

1. **`encrypt-api-key`, `decrypt-api-key`, `delete-api-key`** → fixes saving/using API keys.
2. **`create-order`, `verify-payment`** → enables Razorpay checkout + tier grants.
3. **`generate-single-post`, `generate-calendar`, `regenerate-post`** → core content generation.
4. The rest (`repurpose-post`, `inline-rewrite`, `generate-post-image`, trends/telemetry/queue) as needed.

## Step 4 — Verify

After deploying, an **unauthenticated** call should return **401** (not 404):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/create-order" \
  -H "Content-Type: application/json" -d '{}'
# 401 = deployed & self-authenticating (good).  404 = not deployed yet.
```

Then test end-to-end in the app: save an API key (needs a paid tier), and run a
Razorpay **test-mode** payment (test card `4111 1111 1111 1111`, any future
expiry/CVV) → tier should upgrade.
