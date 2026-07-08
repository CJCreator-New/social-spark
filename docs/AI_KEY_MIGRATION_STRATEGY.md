# AI Key Migration Strategy: Lovable Credits → Founder-Owned API Keys

**Date:** 2026-07-08
**Status:** Strategy document — no code changes made. Every claim below is grounded in the current codebase with file:line citations.

## Goal

All AI-assisted features (calendar generation, single-post generation/regeneration, quality scoring, idea extraction, image generation, repurposing, inline rewrite, AI trend suggestions) currently spend Lovable platform credits via `LOVABLE_API_KEY`. Those credits are finite. This document lays out how to keep every AI feature working under the founder's own API keys — as a fallback when Lovable credits exhaust, or as the primary path.

---

## 1. How Lovable currently injects/controls AI in this stack

**There is no hidden injection.** Lovable's AI access is an ordinary Supabase Edge Function secret plus a hosted gateway endpoint:

- Every AI function reads the key from the environment, e.g. [generate-calendar/index.ts:87](../supabase/functions/generate-calendar/index.ts#L87):

  ```ts
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  ```

  The same pattern appears in `generate-single-post/index.ts:85`, `regenerate-post/index.ts:136`, `repurpose-post/index.ts:70`, `inline-rewrite/index.ts:72`, `extract-ideas/index.ts:94`, `generate-trends/index.ts:61`, and `generate-post-image/index.ts:174`. The error message in each confirms where the secret lives: *"Please set it in Supabase Dashboard → Edge Functions → Manage secrets."*

- The Lovable AI Gateway is an **OpenAI-compatible chat-completions endpoint** serving Google Gemini models. From [\_shared/promptHelpers.ts:158-163](../supabase/functions/_shared/promptHelpers.ts#L158-L163):

  ```ts
  {
    name: "lovable-gateway",
    envKey: "LOVABLE_API_KEY",
    provider: "lovable",
    endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: (q) => (q === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash"),
  }
  ```

- Image generation uses a second Lovable endpoint, hardcoded in [generate-post-image/index.ts:264](../supabase/functions/generate-post-image/index.ts#L264):

  ```ts
  imageRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
  ```

**Implication:** because the key is a plain Supabase secret and the gateway speaks the OpenAI wire protocol, migrating means (a) adding more secrets and (b) using routing logic that — as shown next — **already exists**.

### The routing infrastructure that already exists

The shared helper [\_shared/promptHelpers.ts](../supabase/functions/_shared/promptHelpers.ts) contains a **platform provider waterfall** (`callAIGateway` → `callAIGatewayOnce`, lines 1929–2169). It tries each provider in `PLATFORM_PROVIDER_CHAIN` (lines 156–182) in order, **skipping any entry whose secret is not configured**:

| Order | Chain entry | Secret name | Endpoint | Models used |
|---|---|---|---|---|
| 1 | `lovable-gateway` | `LOVABLE_API_KEY` | `ai.gateway.lovable.dev` | `google/gemini-2.5-pro` / `-flash` |
| 2 | `openrouter` | `PLATFORM_OPENROUTER_KEY` | `openrouter.ai/api/v1` | same Gemini ids |
| 3 | `openai` | `PLATFORM_OPENAI_KEY` | `api.openai.com` | `gpt-4o` / `gpt-4o-mini` |
| 4 | `anthropic` | `PLATFORM_ANTHROPIC_KEY` | `api.anthropic.com` | `claude-3-5-sonnet-latest` / `claude-3-5-haiku-latest` |

The waterfall already handles exactly the failure mode we care about — Lovable credits running out. Per the routing comments at promptHelpers.ts:2094-2098: **429 / 402 / 5xx / timeout → continue to the next provider**; hard 4xx (400/401/403) → abort. It also has a per-provider circuit breaker (3 consecutive failures → 60s cooldown, lines 190–218), retry with exponential backoff (`callAIGateway`, lines 1947–1966), and an endpoint allowlist (`ALLOWED_AI_ENDPOINTS`, lines 71–78) that already whitelists OpenAI, OpenRouter, Gemini-direct, Moonshot (Kimi), and Zhipu (GLM); Anthropic goes through its own dedicated caller (`callAnthropicDirect`, line 1457).

There is also a separate **end-user BYOK path** (users saving their own keys via `encrypt-api-key`, decrypted server-side through the `get_decrypted_api_key` RPC, promptHelpers.ts:1994–2026, with `key_mode: "always" | "fallback"`). That is a *user-level* feature and is untouched by this migration — the founder's keys are the *platform-level* `PLATFORM_*` secrets, tried before any user-key fallback.

---

## 2. Concrete steps to add the founder's own keys

### Step A — set the OpenRouter secret (zero code changes, covers 7 of 8 AI functions)

OpenRouter is the drop-in choice because it accepts the exact `google/gemini-2.5-*` model ids the codebase already uses (see the pinned-model caveat in §5.3 for why OpenAI/Anthropic are *not* drop-in).

Via CLI:

```sh
supabase secrets set PLATFORM_OPENROUTER_KEY=sk-or-v1-...
```

or Supabase Dashboard → Edge Functions → Manage secrets. Edge Functions pick up new secrets on the next cold start; no redeploy of function code is required.

After this single step, `generate-calendar`, `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `extract-ideas`, and `generate-trends` will automatically fail over to the founder's OpenRouter key whenever the Lovable gateway returns 402/429/5xx (i.e., credits exhausted or gateway down).

### Step B — keep `LOVABLE_API_KEY` set, even after migration

Every AI function returns a 500 *before any routing happens* if `LOVABLE_API_KEY` is unset (e.g. [generate-calendar/index.ts:88-96](../supabase/functions/generate-calendar/index.ts#L88-L96)). **Exhausted credits are fine** (the gateway returns 402/429 and the waterfall continues); a **missing key is not** (the function hard-fails at startup). Do not delete the secret. Removing that hard requirement is a small code change, listed as optional in §6.

### Step C — decide fallback vs. primary

- **Fallback (recommended, zero code):** do nothing more. Lovable stays first in the chain; the founder's key absorbs traffic only when credits run out. Cost is zero until Lovable fails.
- **Primary (small code change, not implemented here):** move the OpenRouter entry above `lovable-gateway` in `PLATFORM_PROVIDER_CHAIN` (promptHelpers.ts:156–182). This is a reorder of one array literal. Choose this only if predictable billing on the founder's account matters more than burning down remaining free credits.

### Step D — optional depth: OpenAI and Anthropic tiers

Setting `PLATFORM_OPENAI_KEY` / `PLATFORM_ANTHROPIC_KEY` adds a third and fourth safety net, **but** five callsites pin Gemini model ids that these providers will reject (§5.3), and the Anthropic model ids in the chain (`claude-3-5-sonnet-latest`, promptHelpers.ts:180) should be verified against currently available models before relying on that tier. Treat these as a later hardening step, not part of the initial migration.

---

## 3. Where the routing logic should live

**Where it already lives — nothing should move.** `callAIGateway` in [\_shared/promptHelpers.ts:1929](../supabase/functions/_shared/promptHelpers.ts#L1929) is the single choke point: all seven text-generation functions call it (verified callsites: extract-ideas:172, generate-calendar:209 & 273, generate-single-post:195 & 270, regenerate-post:268 & 346, repurpose-post:154, inline-rewrite:129, generate-trends:117). Note that the `apiKey` argument the functions pass in is ignored — the waterfall reads keys from `Deno.env` directly (promptHelpers.ts:1974, `// kept for signature compat`).

Three code paths sit **outside** the waterfall and are the actual migration gaps — see §5 items 2–4.

---

## 4. Supabase secrets / environment changes

| Secret | Action | Why |
|---|---|---|
| `LOVABLE_API_KEY` | **Keep set** (already set) | Functions 500 at startup without it (§2 Step B) |
| `PLATFORM_OPENROUTER_KEY` | **Add now** | Activates fallback for all 7 waterfall functions, zero code |
| `PLATFORM_OPENAI_KEY` | Optional, later | Third tier; limited by pinned Gemini model ids (§5.3) |
| `PLATFORM_ANTHROPIC_KEY` | Optional, later | Fourth tier; same caveat + verify model ids |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | No change | Unrelated to AI routing |

All are set via `supabase secrets set NAME=value` or Dashboard → Edge Functions → Manage secrets — the same mechanism the code's own error messages point to. No frontend env changes are needed: the browser never holds any of these keys; routing is entirely server-side in the Edge Functions.

Quota accounting is unaffected: the `usingSharedKey` check in each function (e.g. generate-calendar/index.ts:75) keys off the *user's* BYOK settings, not which platform provider served the request, so platform-key fallbacks still count against user quotas exactly as Lovable-served requests do.

---

## 5. Prioritized migration order

Ordered by volume × failure exposure:

### Priority 1 — Set `PLATFORM_OPENROUTER_KEY` (config only, do today)

Covers the highest-volume feature (calendar generation, which fans out into topic enrichment, per-day generation, polish passes, and judge scoring) plus six other functions. This single secret converts "Lovable credits run out → app's AI dies" into "Lovable credits run out → traffic silently shifts to the founder's key."

### Priority 2 — `generate-post-image` fallback (small code change; the only hard outage)

Image generation is the **one feature with no fallback whatsoever**: it fetches `https://ai.gateway.lovable.dev/v1/images/generations` directly (index.ts:264) with `model: "google/gemini-2.5-flash-image"` and returns the gateway's error status to the user on failure (index.ts:289-296). When Lovable credits exhaust, image generation is down, full stop.

Scoped fix (not implemented here): on a 402/429/5xx from the Lovable images endpoint, retry against a founder-key image provider — the natural fit is the Gemini API directly (same `gemini-2.5-flash-image` family under a `GEMINI_API_KEY` secret), or OpenAI's images API under `PLATFORM_OPENAI_KEY`. This is one retry branch inside `generate-post-image/index.ts`; no new abstraction needed.

### Priority 3 — route `enrichTopics` and `scoreVariants` through the waterfall (small code change; silent quality degradation)

Two shared helpers bypass the waterfall and call the Lovable gateway directly whenever the end user has no BYOK key:

- `enrichTopics` — direct fetch at promptHelpers.ts:1706; on failure it degrades to template-padded topics (`padTopics`).
- `scoreVariants` (the LLM judge behind quality scoring) — direct fetch at promptHelpers.ts:1877; on failure it returns uniform 3/5 scores for every variant (promptHelpers.ts:1913-1922).

Neither takes the app down, which is why they're Priority 3 — but once Lovable credits exhaust, **every calendar gets generic topic angles and every variant scores a flat 3/5**, silently. The scoped fix is to have their non-BYOK branches call `callAIGateway` instead of `fetch(...lovable...)` directly.

### Priority 4 — optional: OpenAI/Anthropic tiers + the pinned-model fix

Five `callAIGateway` callsites pass an explicit Gemini model id: `extract-ideas/index.ts:180`, `inline-rewrite/index.ts:137`, `generate-trends/index.ts:125` (`"google/gemini-2.5-flash"`), and the polish passes at `generate-calendar/index.ts:281` and `generate-single-post/index.ts:278` (`"google/gemini-2.5-pro"`). The waterfall uses `opts.model || entry.model(quality)` (promptHelpers.ts:2111), so that Gemini id is sent verbatim to OpenAI/Anthropic, which return a hard 400 — and a hard 4xx **aborts the whole waterfall** (promptHelpers.ts:2136-2144). OpenRouter is unaffected because it natively accepts `google/gemini-2.5-*` ids — which is precisely why it is the Priority-1 choice.

If the founder later wants OpenAI/Anthropic as deeper fallbacks, the scoped fix is to make the waterfall map or drop the explicit model override per provider (use `entry.model(quality)` when `opts.model` doesn't belong to that provider). Until then, OpenAI/Anthropic keys still help the callsites that pass only `quality` (the main generation calls in generate-calendar:209, generate-single-post:195, regenerate-post:268, repurpose-post:154).

---

## 6. Per-function self-check (every AI-capable function from the one-pager)

| Edge Function | How it calls AI today | Founder-key routing after migration |
|---|---|---|
| `generate-calendar` | `callAIGateway` (index.ts:209 main, :273 polish) + `enrichTopics` (index.ts:108) | Main + polish: **covered by Priority 1** (polish pins `gemini-2.5-pro` → OpenRouter only). Enrichment: **Priority 3**. |
| `generate-single-post` | `callAIGateway` (index.ts:195, :270 polish) + `scoreVariants` (index.ts:245) | Main + polish: **Priority 1**. Judge scoring: **Priority 3**. |
| `regenerate-post` | `callAIGateway` (index.ts:268, :346 polish) + `scoreVariants` (index.ts:319) | Same as above: **Priority 1** + **Priority 3**. |
| `repurpose-post` | `callAIGateway` (index.ts:154) + `scoreVariants` (index.ts:203) | **Priority 1** + **Priority 3**. |
| `extract-ideas` | `callAIGateway` (index.ts:172), pins `gemini-2.5-flash` | **Priority 1** (OpenRouter honors the pinned id; OpenAI/Anthropic need Priority 4 fix). |
| `inline-rewrite` | `callAIGateway` (index.ts:129), pins `gemini-2.5-flash` | **Priority 1** (same caveat). |
| `generate-trends` (AI trend suggestions) | `callAIGateway` (index.ts:117), pins `gemini-2.5-flash` | **Priority 1** (same caveat). |
| `generate-post-image` | Direct fetch to Lovable images endpoint (index.ts:264), **no fallback** | **Priority 2** — requires the one scoped code change; no config-only path exists. |
| `trends-ingest` | **No AI calls.** Upserts a hardcoded list of simulated trends into the `trends` table (index.ts:58-75). | Out of scope — nothing to migrate. (The one-pager's "trend ingestion pipeline" does not currently consume AI credits.) |
| `trends-read` / `trends_read` | **No AI calls** — database reads of the `trends` table. | Out of scope — nothing to migrate. |
| `mcp` | Auto-generated Lovable MCP server (index.ts:1); exposes workspace tools, makes no model calls itself. | Out of scope — external agents bring their own models. |
| `encrypt-api-key` | Calls `callAI` once with the *user's candidate key* to validate it (index.ts:99) — never spends Lovable credits. | Out of scope — already uses user keys by design. |

Remaining functions (`health`, `telemetry`, `queue-worker`, `cleanup-media`, `create-order`, `verify-payment`, `decrypt-api-key`, `delete-api-key`, `adapters/*`) make no model calls — confirmed by searching the `supabase/functions` tree for the Lovable gateway URL, provider env keys, and `callAI*` callsites.

---

## 7. Validation checklist before go-live

1. **Confirm the secret landed:** `supabase secrets list` shows `PLATFORM_OPENROUTER_KEY`.
2. **Force the fallback path in staging:** in a staging Supabase project (or off-hours), set `LOVABLE_API_KEY` to an intentionally invalid value — the gateway will return 401/403… note this is a *hard* 4xx which aborts the waterfall, so instead prefer setting it to a key with exhausted credits, or temporarily reorder the chain in staging. Simplest reliable check: watch the logs (next step) during normal use as Lovable returns 429/402.
3. **Watch the structured waterfall logs** in Supabase Dashboard → Edge Functions → Logs. The code logs every hop: `[waterfall] trying openrouter (model: ...)`, `[waterfall] openrouter succeeded`, `[waterfall] <name> returned <status>`, and `[circuit-breaker] ... tripped` (promptHelpers.ts:2107-2133, 213-215). A successful migration shows `trying lovable-gateway` → failure status → `trying openrouter` → `succeeded`.
4. **Exercise each feature once** end-to-end from the UI: generate a calendar, generate/regenerate a single post, repurpose a post, run an inline rewrite, extract ideas from pasted source, request AI trend suggestions, and generate a post image (the image will still fail on exhausted Lovable credits until Priority 2 ships — verify the failure is the expected clean 4xx/5xx JSON error, not a hang).
5. **Verify quota accounting still increments** for a shared-key user after a fallback-served generation (the `usingSharedKey` → `incrementGenerationCount` path, e.g. generate-post-image/index.ts:298-300).
6. **Check output quality flags:** posts still arrive markdown-free (`stripMarkdownFormatting` runs on every AI text field regardless of provider, promptHelpers.ts:111) and variant scores are not uniformly 3/5 (which would indicate `scoreVariants` silently degrading — expected until Priority 3 ships).
7. **Set a billing cap / usage alert** on the OpenRouter account so a traffic spike after failover can't run up an unbounded bill.

---

## Plain-language summary

ContentForge's AI features all get their intelligence through one Lovable-provided key stored as an ordinary Supabase secret, and the app already contains a built-in "waterfall" that can try other providers automatically whenever Lovable fails or runs out of credits — those extra slots are just empty right now. The core migration is therefore a configuration change, not a rebuild: the founder creates an OpenRouter account, sets its key as the `PLATFORM_OPENROUTER_KEY` secret in the Supabase dashboard, and seven of the eight AI features (calendar generation, single-post generation and regeneration, repurposing, inline rewrite, idea extraction, and trend suggestions) will silently fail over to the founder's own billing the moment Lovable credits are exhausted. OpenRouter specifically is the right first key because it accepts the exact Gemini model names already hardcoded in the app, whereas OpenAI or Anthropic keys would be rejected by several call sites until a small model-mapping fix is made. Two real gaps need small code changes afterward: image generation calls Lovable directly with no fallback at all (it will simply stop working when credits die), and the topic-enrichment and quality-scoring helpers bypass the fallback system, so they'd quietly degrade to generic topics and flat 3/5 scores. The Lovable key must stay set even after migrating, because every function refuses to start without it — an exhausted key is handled gracefully, a missing one is not. Before trusting the setup, the founder should watch the Supabase function logs for the `[waterfall] trying openrouter … succeeded` lines while exercising each feature once from the UI, confirm quota counting still works, and put a spending cap on the OpenRouter account. The trends-ingest and trends-read functions need nothing: despite the one-pager's framing, they don't call AI at all today.
