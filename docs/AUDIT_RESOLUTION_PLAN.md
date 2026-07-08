# ContentForge Full-App Audit — Resolution Plan (2026-07-08)

> Diagnosis-only audit across eight domains: state/data integrity, AI pipeline correctness,
> platform-native formatting, Brand Memory enforcement, trend ingestion, MCP/OAuth,
> UI/UX consistency, and go-to-market readiness. Every issue below carries a code-level
> evidence anchor and a fix scoped strictly to the stated problem — no bonus refactors.
>
> Verification baseline: `npm run test:run` passes cleanly (44 files, 366 tests) on this
> working tree, so all fixes below can be regression-gated against a green suite.

---

## How to read this document

- **ID** — stable reference for tracking (`CF-##`).
- **Evidence anchor** — file:line that proves the issue exists as stated.
- **Fix** — the minimal change that resolves the issue. Where a fix touches an edge
  function, re-run the relevant unit tests plus a manual generation pass.
- Issues are ordered by severity, then by user impact within a severity band.
- Cross-references to the existing backlog: several items were already acknowledged in
  `docs/ENHANCEMENT_ROADMAP_PLAN.md` (marked *[known backlog]*), but their severity here
  reflects that the one-pager sells them as shipped features today.

---

## CRITICAL

### CF-01 — Local draft auto-recovery is a production no-op: cleanup deletes every draft on mount
- **Domain:** State & data integrity
- **Evidence:** `src/lib/storageService.ts:84-85` — `saveDraft` always stores an
  **encrypted** (XOR + base64) envelope:
  ```ts
  const encrypted = encryptDraftData(serialized, token);
  window.localStorage.setItem(storageKey(key), encrypted);
  ```
  But `cleanupExpiredDrafts` (`storageService.ts:144-150`) parses the raw stored value as
  plaintext JSON and deletes anything that fails:
  ```ts
  const env = JSON.parse(raw) as DraftEnvelope<unknown>;
  ...
  } catch (e) {
    // corrupted — remove
    window.localStorage.removeItem(k);
  ```
  Every encrypted draft is base64, so `JSON.parse` throws and the key is removed.
  `cleanupExpiredDrafts()` runs first in the hydrate effect (`src/pages/Index.tsx:951`),
  before the local draft is read at `Index.tsx:958` — so `localDraft` is always `null`.
  This is already documented as a known bug in
  `src/pages/__tests__/Index.draftRestore.test.tsx:64-83`, and
  `storageService.test.ts:24-30` passes for the wrong reason (draft removed as *corrupt*,
  not *expired*).
- **Impact:** The recovery-dialog subsystem and the "sync newer local → server" branch
  (`Index.tsx:987-991`) never fire. Guest users have **no** draft recovery at all. The only
  reason logged-in users don't notice is the separate Zustand `cf:wizard` persist layer
  (different key prefix, untouched by cleanup) that silently restores posts/form on
  same-tab refresh.
- **Fix:** In `cleanupExpiredDrafts`, mirror `loadDraft`: read the item, decrypt with
  `decryptDraftData(raw, getSessionToken())`, then `JSON.parse` the decrypted string, and
  remove **only** on genuine `expiresAt` expiry. Do not delete on decrypt/parse failure
  (a wrong-session-token item is not expired). Update the two tests above to assert the
  corrected behaviour.

### CF-02 — `bannedWords` is silently dropped: never in any prompt, never checked on output
- **Domain:** Brand Memory enforcement
- **Evidence:** `supabase/functions/_shared/promptHelpers.ts:1076` cleans it
  (`bannedWords: cleanList(payload.bannedWords, 20)`), the interface declares it (line
  949) — and that is the last reference. No prompt builder (`buildSystemMessage`,
  `buildPromptContext`, `buildStrategicPromptFramework`) and no output validator
  (`normalizePost`) ever reads `payload.bannedWords`. There is a
  `buildRequiredWordsBlock` (lines 332-335); there is no banned-words equivalent. The
  client sends the field on every generation path (`src/pages/Index.tsx:1323,1451,1692`;
  `src/pages/CalendarDetail.tsx:602,1007,1519`).
- **Impact:** A user enters banned words in the wizard; they are transmitted, cleaned,
  and discarded. Banned terms ship in production copy. The feature is a no-op.
- **Fix:** (a) Add a `buildBannedWordsBlock(payload.bannedWords)` appended in
  `buildSystemMessage` alongside the required-words block; (b) in `normalizePost`, scan
  `hook`/`body`/`cta` for each banned word (mirror the required-words loop at
  `promptHelpers.ts:2331-2356`), pushing hits into `self_check.forbidden_violations` and
  setting `checks_passed = false`.

### CF-03 — Brand Memory forbidden phrases are prompt-hints only; no output path validates them
- **Domain:** Brand Memory enforcement
- **Evidence:** Forbidden phrases reach the model only as free text inside the
  `brandMemory` string (`src/lib/brandMemory.ts:30-34` → "FORBIDDEN PHRASES (NEVER USE)"),
  embedded via `buildStrategicPromptFramework` (`promptHelpers.ts:1153`). `normalizePost`
  checks required words but contains no forbidden-phrase scan. Nothing catches a model
  that ignores the instruction.
- **Impact:** Brand forbids "cheap"; model uses "cheap"; the post passes through
  unflagged. The one-pager's "100% brand consistency" claim has no enforcement layer.
  *[known backlog — roadmap item 1.3, but sold as shipped]*
- **Fix:** Pass forbidden phrases as a structured `forbiddenPhrases: string[]` field
  (alongside the existing `brandMemory` string) from the client, and in `normalizePost`
  scan output fields for each phrase, recording violations into `self_check` exactly as
  CF-02. One shared checker can serve both CF-02 and CF-03 — same loop, two input lists.

### CF-04 — `extract-ideas` and `inline-rewrite` never receive brand context at all
- **Domain:** Brand Memory enforcement / AI pipeline
- **Evidence:** `supabase/functions/extract-ideas/index.ts:111-128` builds its own
  `systemMsg`/`userMsg` and never calls `buildSystemMessage`/`buildPromptContext`;
  `supabase/functions/inline-rewrite/index.ts:88-100` likewise hand-rolls its system
  prompt. `RepurposePayload` (`_shared/shared.ts:53-59`) has no `brandMemory`/`bannedWords`
  fields, so repurpose also typically runs brand-blind even though its server would honor
  the field if present (`repurpose-post/index.ts:92`).
- **Impact:** Extracted ideas and inline rewrites ("make punchier") can freely emit
  off-voice copy and brand-forbidden phrasing — precisely the flows users trust to stay
  on-brand.
- **Fix:** Thread the existing `brandMemory` string (and the CF-02/CF-03 structured
  lists) into the `extract-ideas` and `inline-rewrite` system prompts, add
  `brandMemory`/`bannedWords` to `RepurposePayload`, and apply the shared post-generation
  scan from CF-02/CF-03 to their outputs.

### CF-05 — Trend pipeline never runs: `trends-ingest` has no cron job, so the `trends` table is empty
- **Domain:** Trend ingestion
- **Evidence:** The only `cron.schedule` calls in the repo register
  `social-spark-queue-worker` and `social-spark-cleanup-media`
  (`supabase/migrations/20260515193000_schedule_queue_and_cleanup.sql`,
  `20260703091500_fix_cron_worker_auth.sql`). No migration schedules `trends-ingest`.
  The DB→prompt injection path is correctly coded (`generate-single-post/index.ts:112-113`
  fetches via `getTrendingTopics`, injected at `promptHelpers.ts:1154`) — it is a no-op
  only because nothing ever populates the table.
- **Impact:** The one-pager's "scheduled cron job ingests platform trend data" is not
  operational. `getTrendingTopics()` returns `[]` in production; trend injection renders
  an empty string.
- **Fix:** Add a migration with a `cron.schedule('social-spark-trends-ingest', …)` block
  mirroring lines 30-43 of `20260703091500_fix_cron_worker_auth.sql` (vault-sourced
  `x-cron-secret`). Must be paired with CF-13 (config.toml gate) or the call 401s.

### CF-06 — Split brand identity: onboarding and the payment popup say "Social Spark", everything else says "ContentForge"
- **Domain:** GTM readiness
- **Evidence:** `src/constants/branding.ts:1` — `export const APP_NAME = "ContentForge";`
  used across Landing, Terms, Privacy, Docs, NotFound, etc. But:
  `src/components/OnboardingTour.tsx:15,17` — "Welcome to Social Spark ✨";
  `src/components/WelcomeBanner.tsx:41,77` — "Welcome to Social Spark";
  `src/lib/razorpayCheckout.ts:153` — checkout modal name defaults to "Social Spark".
- **Impact:** A new user's first screen and the **payment dialog** carry a different brand
  than the site — reads as phishing at the two highest-trust moments (signup, checkout).
- **Fix:** Replace the hardcoded "Social Spark" strings in those three files with
  `APP_NAME` from `src/constants/branding.ts`. Internal `localStorage` keys
  (`social_spark_*`) may stay.

### CF-07 — Landing pricing contradicts the real billing product (currency, names, prices, features)
- **Domain:** GTM readiness
- **Evidence:** `src/components/landing/Pricing.tsx:8-61` — USD tiers Free / Pro $29 /
  Team $79 with "Unlimited posts", "Performance analytics", "Team collaboration",
  "API access", "White-label exports"; CTAs link to `/auth?plan=pro|team`.
  Actual billing `src/components/settings/PlanSettings.tsx:20-59` — INR tiers Free ₹0 /
  Starter ₹199 / Pro ₹499, features are monthly generation counts + BYOK. No Team plan,
  no Starter on landing, no "Unlimited" anywhere real.
- **Impact:** A user who clicks "Team $79" lands in a checkout offering ₹499 Pro at most —
  a conversion-killing bait-and-switch and a pricing-integrity/legal exposure.
- **Fix:** Render the landing `Pricing` component from the same plan definitions used by
  `PlanSettings` (the `_shared/plans.ts` source of truth): same tier names, INR prices,
  and real feature lists. Delete the fictional feature bullets.

---

## HIGH

### CF-08 — User-selected trending topics are silently dropped server-side
- **Domain:** Trend ingestion / AI pipeline
- **Evidence:** Client sends the selection (`src/pages/Index.tsx:1470,1475` —
  `...(selectedTrendingTopics.length > 0 ? { trendingTopics: selectedTrendingTopics } : {})`),
  but `cleanPayload` (`promptHelpers.ts`) rebuilds the payload from an explicit field list
  that **omits `trendingTopics`** (verified: the interface declares it at line 956 and the
  prompt consumes `payload.trendingTopics` at line 1154, but `cleanPayload` never copies
  it). The generate functions then overwrite it from the (empty — CF-05) DB:
  `generate-single-post/index.ts:112-113`.
- **Impact:** "Use This Trend" shows success UI, then has zero effect on output.
- **Fix:** Add `trendingTopics: cleanList(payload.trendingTopics, 10)` to `cleanPayload`,
  and in `generate-single-post`/`generate-calendar` merge the client list with (or prefer
  it over) the `getTrendingTopics` DB fetch instead of overwriting.

### CF-09 — No MCP tool enforces scopes; the OAuth consent grant is not binding
- **Domain:** MCP / OAuth
- **Evidence:** Every tool handler gates only on authentication, e.g.
  `src/lib/mcp/tools/get-calendar.ts:21-24`:
  ```ts
  if (!ctx.isAuthenticated()) { return { ...isError: true }; }
  // proceeds straight to the query; no scope check anywhere
  ```
  Grep for `getScopes|hasScope|requiredScopes` across `src/lib/mcp/tools` → no matches.
  The issuer config (`src/lib/mcp/index.ts:16-20`) declares no scopes. (OAuth 2.1
  mechanics — PKCE, redirect URIs, code/token lifecycle — are delegated to Supabase
  Auth's platform OAuth server and are not implementable/auditable from this repo.)
- **Impact:** The consent screen displays scopes (`OAuthConsent.tsx:130-136`) but any
  accepted token can call every tool. Today all three tools are read-only
  (`readOnlyHint: true`) and RLS confines data to the token's user, so blast radius is
  over-broad *read* access — but the first write tool added under this template becomes a
  consent bypass.
- **Fix:** Register per-tool scopes on the issuer (`auth.oauth.issuer({ scopes: … })`) and
  reject in each handler when the token lacks that tool's scope, next to the existing
  `isAuthenticated()` check.

### CF-10 — Platform character limits are prompt-suggestions, not enforced at generation
- **Domain:** AI pipeline / platform formatting
- **Evidence:** The only server-side mention of 280 is a prompt string —
  `promptHelpers.ts:1024`: `"Strictly enforce the 280-character limit instruction."`
  `normalizePost` does a word-count soft check that explicitly does not reject
  (`promptHelpers.ts:2321-2326`, "Allowing but flagging"). Real limits exist only
  client-side at copy time (`src/lib/platformCopy.ts:6-12`), where the X branch
  hard-truncates mid-sentence with an ellipsis (`platformCopy.ts:182-194`).
- **Impact:** A 480-character X post is returned, stored, and shown as valid; the user
  discovers the problem only as silent lossy truncation at copy time — or not at all if a
  consumer reads `post.body` directly.
- **Fix:** Add a shared `PLATFORM_CHAR_LIMITS` map in `promptHelpers.ts`; in
  `normalizePost`, when `hook + body + cta` exceeds the platform limit, record it in
  `self_check` and set `checks_passed = false` for X (the only hard-fail platform).
  Optionally one tightening re-ask for X when over 280. Do not add regeneration loops
  beyond that.

### CF-11 — `timeoutMs` is dead code: no fetch timeout exists, and the timeout-retry branch is unreachable
- **Domain:** AI pipeline
- **Evidence:** Neither `callOpenAiCompatibleDirect` (`promptHelpers.ts:1438-1453`) nor
  `callAnthropicDirect` (`1502-1519`) attaches an `AbortSignal` to `fetch` (grep: no
  `AbortController`/`AbortSignal` in the file). The retry guard
  `lastResult.error === "AI request timeout"` (`1958`) can never be true.
- **Impact:** A hung provider blocks the edge function until the platform wall-clock kills
  it — long spin, generic 500 — and the provider-waterfall fast-fail never triggers.
- **Fix:** In both direct-call helpers, pass
  `signal: AbortSignal.timeout(opts.timeoutMs ?? 30000)`, catch the abort, and return
  `{ status: 504, error: "AI request timeout" }` so the existing retry/waterfall logic
  activates unchanged.

### CF-12 — Draft encryption key lives in `sessionStorage`: recovery cannot survive browser close, and tabs destroy each other's drafts
- **Domain:** State & data integrity
- **Evidence:** `src/lib/storageService.ts:23` —
  `sessionStorage.getItem("ss_session_token")`. `loadDraft` deletes the draft when
  decryption fails (`storageService.ts:116-118`: "corrupted or wrong session — remove").
  `sessionStorage` is per-tab and cleared on browser close, so (a) reopening the browser
  regenerates the token and the read path wipes the draft; (b) a second tab holds a
  different token and wipes the first tab's draft on load.
  `storageService.test.ts:70-81` asserts this destructive behaviour as intended.
- **Impact:** Even after CF-01 is fixed, close-and-reopen recovery — the headline
  "Draft Auto-Recovery" promise — fails for the envelope layer; only same-tab refresh
  survives (via Zustand persist).
- **Fix:** Derive the obfuscation key from a stable per-device value in `localStorage`
  (the payload is a non-sensitive wizard draft; XOR is obfuscation, not security), and on
  decrypt failure return `null` without deleting — let TTL own deletion. Update the test.

### CF-13 — Even if scheduled, `trends-ingest` would be 401'd: missing `verify_jwt = false` gate
- **Domain:** Trend ingestion
- **Evidence:** `trends-ingest` self-authenticates via `verifyCronSecret`
  (`promptHelpers.ts:514-519`), the same mechanism the cron migration uses for
  queue-worker — but `trends-ingest` is absent from `supabase/config.toml`, so the
  platform default `verify_jwt = true` applies, rejecting a cron call that carries only
  `x-cron-secret` (the exact failure class migration `20260703091500` fixed for
  queue-worker, which *is* listed at `config.toml:15-16`).
- **Impact:** CF-05's fix silently fails at the platform gate.
- **Fix:** Add `[functions.trends-ingest]\nverify_jwt = false` to `supabase/config.toml`,
  with the same self-auth comment style used for the API-key functions.

### CF-14 — An entire orphaned second trends pipeline ships as dead (and partially broken) code
- **Domain:** Trend ingestion / code hygiene
- **Evidence:** `supabase/functions/trends_read/index.ts` uses Node `process.env` (line 7),
  imports bare `@supabase/supabase-js` (line 4), exports a `handler` with **no
  `Deno.serve` entrypoint** (line 12) — it cannot run as an edge function — and queries a
  `trending_topics` table (line 37) created only by `migrations/0001_...` in a separate,
  never-applied migrations folder. `scripts/deploy_trends.sh:13-16` deploys four
  underscore-named functions that don't exist; `docs/DEPLOY_TRENDS_RUNBOOK.md:6` points at
  `src/lib/trendsApi.ts`, which does not exist; no edge function imports anything from
  `supabase/functions/adapters/`.
- **Impact:** Confuses every future contributor and audit; the deploy script and runbook
  actively mislead; the hyphenated `trends-read` (the schema-correct reader for the live
  `trends` table) is meanwhile unused by any client.
- **Fix:** Delete Pipeline B: `supabase/functions/trends_read/`,
  `supabase/functions/adapters/`, `scripts/deploy_trends.*`, the orphan `migrations/0001`
  folder, and `docs/DEPLOY_TRENDS_RUNBOOK.md` (or rewrite it for the live pipeline).
  Decide `trends-read`'s fate in the same change: either wire `InspirationBank` to it
  (roadmap 1.2) or remove it too.

### CF-15 — "Scheduling" never publishes anywhere; it is a manual status tracker
- **Domain:** GTM readiness
- **Evidence:** `src/pages/Schedule.tsx:226-243` — "Mark published" writes
  `workflow_status` + `published_at` to the DB and toasts; the only outputs are CSV export
  (line 316) and copy-to-clipboard (line 264). No publish edge function exists (the
  functions list contains nothing that posts to a platform).
- **Impact:** The one-pager's "Timezone-Aware Publisher" and scheduling positioning imply
  auto-publish; users get a to-do checklist. *[known backlog — roadmap Bet 1]*
- **Fix (proportionate, pre-connector):** Relabel the surface honestly — "Publishing
  queue: copy, post manually, mark done" — in `Schedule.tsx` copy and any landing/brief
  text that implies auto-publishing. Building connectors is a roadmap bet, not a bug fix.

### CF-16 — Landing page advertises engagement analytics that do not exist
- **Domain:** GTM readiness
- **Evidence:** `src/components/landing/FeatureShowcase.tsx:231` — "tracks what resonates
  — which hooks get clicked, which CTAs convert, which platforms grow your audience";
  `Pricing.tsx:31` — "Performance analytics". No `/analytics` route exists in
  `src/App.tsx` (routes: `/app`, `/profile`, `/my-calendars`, `/calendar/:id`,
  `/schedule`, `/repurpose`, `/admin`); end-user analytics is client-computed text
  heuristics (`CalendarDetail.tsx:1702-1730`, comment: "client-computed, no backend");
  real charts are admin-only behind `AdminRoute` (`App.tsx:186-193`).
- **Impact:** Click/conversion tracking is promised and absent — churn and refund risk the
  moment a paying user looks for it.
- **Fix:** Reword the landing claims to what exists ("AI performance scoring that
  estimates hook, CTA, and readability strength before you post"). Building real
  telemetry is roadmap 3.2, not this fix.

### CF-17 — Dark-theme lime styling and an undefined CSS token corrupt the two headline feature cards
- **Domain:** UI/UX consistency
- **Evidence:** The app is forced-light with a warm-orange palette
  (`src/constants/branding.ts:6` — `BRAND_COLOR = "#c2410c"`), yet hardcoded lime
  `rgba(200,240,154,…)` literals appear 31 times across 7 files. Worst:
  `src/components/PerformanceScoreCard.tsx:186` (lime readability label) and `:248-250`,
  where the "🎯 Fix" button uses `var(--text-accent)` — **defined nowhere in `src/`**
  (grep: zero definitions) — over a lime-tinted background. `InspirationBank.tsx:88,102,149`
  carries dark-surface modal styles (`rgba(255,255,255,0.02)` backgrounds, heavy black
  shadows).
- **Impact:** The quality-scoring card and trend picker — the two most-demoed features —
  look broken/off-brand against the polished orange UI.
- **Fix:** In those 7 files, replace lime literals and `--text-accent` with the existing
  warm aliases (`--accent`, `--text2`, `--text3`, `--surface`, `--border2` — already
  mapped in `src/pages/Index.css:8-19` and `src/styles/contentforge.css:16-27`). No
  design-system rebuild.

### CF-18 — Real prices are hidden behind auth; landing CTAs bypass the working checkout
- **Domain:** GTM readiness
- **Evidence:** Landing CTAs route to `/auth?plan=pro|team` (`Pricing.tsx:36,58`); the
  functional Razorpay checkout (`RazorpayCheckoutButton` → `create-order`/`verify-payment`)
  is reachable only inside `/profile?tab=plan` (`PlanSettings.tsx:204-224`).
- **Impact:** Compounds CF-07: users discover the real (different) prices only
  post-signup, deep in settings.
- **Fix:** After CF-07 unifies the plan data, have the landing CTA deep-link to
  `/profile?tab=plan` post-auth (carry the `plan` query param through the auth redirect).

---

## MEDIUM

### CF-19 — Zustand persist has no `version`/`migrate`/`merge`; future shape changes corrupt returning users' state
- **Evidence:** `src/stores/useWizardStore.ts:154-165` — persist config is only
  `name` + `partialize`. Default shallow merge means a persisted `form` **replaces**
  `INITIAL_FORM` wholesale; any later-added field rehydrates as `undefined` and crashes
  consumers like `hasMeaningfulDraft` (`Index.tsx:1041-1058` calls `.trim()` on fields).
- **Fix:** Add `version: 1` plus a `merge` (or `migrate`) that deep-merges persisted
  `form` over `INITIAL_FORM` so missing fields fall back to defaults.

### CF-20 — "Discard draft" doesn't discard: the Zustand layer keeps the wizard populated
- **Evidence:** `src/pages/Index.tsx:1160-1165` — `discardDraft` calls `clearDraft()`
  (envelope + server row only) and toasts "Start fresh below", but `cf:wizard` has already
  rehydrated `posts`/`form`/`step`, which remain on screen.
- **Fix:** Call the store's `reset()` inside `discardDraft`.

### CF-21 — Recovery dialog suppressed for the whole session before the user acts
- **Evidence:** `src/pages/Index.tsx:981-985` — `ss_recovery_prompted` is set to `"true"`
  at **display** time; a crash or second refresh before choosing Restore/Discard means the
  dialog never reappears though the draft still exists.
- **Fix:** Move the `sessionStorage.setItem` into `restoreDraft`/`discardDraft` (set on
  resolution, not display).

### CF-22 — Draft conflict resolution trusts client clocks; server `updated_at` is ignored
- **Evidence:** `src/pages/Index.tsx:960-963,987-991` — newest-draft selection and the
  local→server overwrite both compare client-stamped `savedAt` (`Date.now()`,
  `Index.tsx:292`); `readServerDraft` (`Index.tsx:383-386`) never selects the
  `wizard_drafts.updated_at` the trigger maintains
  (`20260508173000_create_wizard_drafts.sql:26-27`).
- **Impact:** Clock skew across devices lets an older draft overwrite a newer one.
- **Fix:** Select `updated_at` in `readServerDraft` and use it as the cloud side of both
  comparisons.

### CF-23 — Newsletter and Blog outputs are not structurally differentiated
- **Evidence:** `promptHelpers.ts:1019-1028` — `buildContentRules` has branches for
  LinkedIn/X/Instagram (paragraph chunking, 280-char instruction, double-newline + tag
  counts) but **no Newsletter or Blog branch**; long-form differs only via hashtag
  suppression (`buildHashtagInstr`, line 427). (LinkedIn/X/Instagram/Facebook/TikTok *are*
  genuinely differentiated via `buildEngagementRules`:337-356 and `getPlatformPreset`
  :358-373 — the brief's platform-native claim holds for those five.)
- **Fix:** Add Newsletter and Blog branches to `buildContentRules` (subject line/title,
  section structure, longer form, no hashtags) — mirroring the richer per-target guidance
  `repurpose-post/index.ts:104-110` already hardcodes.

### CF-24 — Variant winner is the LLM's self-reported index, not derived from its own scores
- **Evidence:** `promptHelpers.ts:1906` — `scoreVariants` trusts `parsed.winner_index`
  directly; if the model scores variant 2 highest but says `winner_index: 0`, variant 0
  wins. Fallback path returns uniform 3s with `winner_index: 0` (`1914-1924`). The client
  score badge (`src/lib/postPerformanceScore.ts:290-323`) is a separate heuristic, so the
  "winning" variant and its displayed score can disagree.
- **Fix:** Compute `winner_index` server-side as the argmax of the summed `results`
  scores, guarding against out-of-range indices.

### CF-25 — `extract-ideas` can silently return fewer than the 3-idea floor
- **Evidence:** `supabase/functions/extract-ideas/index.ts:217-241` — after dedup/filter,
  only `ideas.length === 0` errors; 2 usable ideas against a request of 5 returns HTTP 200
  with `{ ideas: [2], requested: 5 }`. (Input caps are properly enforced: 200/20,000 chars
  → HTTP 400 at lines 53-64; count clamped 3-10 at 48-51.)
- **Fix:** When `ideas.length < 3`, retry once; if still short, include an explicit
  `partial: true` flag in the response so the UI can say so.

### CF-26 — `trends` table has no read-path indexes and no retention
- **Evidence:** `supabase/migrations/20260707040000_create_trends_table.sql` — only the
  `unique_keyword_source` constraint index; `trends-read` and `getTrendingTopics` order by
  `volume DESC` and filter `ilike("category", …)` with no supporting index, and no TTL or
  cleanup exists, so stale keywords rank forever.
- **Fix:** One migration: `CREATE INDEX ON public.trends (category, volume DESC);` add a
  `last_seen timestamptz` refreshed on upsert, and extend the existing cleanup cron to
  delete rows with `last_seen` older than 14 days.

### CF-27 — Any authenticated user can trigger a full trends re-ingest; batch is all-or-nothing
- **Evidence:** `supabase/functions/trends-ingest/index.ts:32-43` — the user-token branch
  has no admin check; lines 72-80 — one bulk upsert where a single bad row fails the whole
  batch with a generic 500. (Currently harmless — the data is a hardcoded
  `simulatedTrends` array, lines 58-69 — but becomes an abuse/cost vector with real
  ingestion.)
- **Fix:** Restrict the non-cron path to admins (reuse the existing admin check used by
  admin RPCs), and chunk the upsert per-source so one bad source doesn't void the batch.

### CF-28 — "Topic Gap Detection" is an AI-inferred-topics flag, not gap analysis
- **Evidence:** `src/components/TopicGapBadge.tsx:12,20-22` —
  `if (!isInferred) return null; … 🤖 AI-inferred` — shown only when the user left topics
  blank (`Index.tsx:1480-1488`). No analysis of missing/under-covered categories exists.
  *[known backlog — roadmap 1.1/1.4 build on a capability the brief says already exists]*
- **Fix:** Either rename the surface honestly ("AI-inferred topics") in UI and brief, or
  implement the minimal real version: compare the calendar's post categories against the
  user's configured topic list and badge the absent ones. Pick one; don't ship the
  mismatch.

### CF-29 — Three parallel styling systems drive the visual drift
- **Evidence:** Tailwind utilities (`MyCalendars.tsx:376-382`), BEM-ish custom CSS
  (`contentforge.css`, `pages.css`, `Index.css` — `.sc-*`, `.mc-*`, `.perf-*`, `.rp-*`),
  large inline-style objects (`MyCalendars.tsx:341-371`, `InspirationBank.tsx`), plus a
  runtime `<style>` injection (`CalendarDetail.tsx:1762`).
- **Fix (proportionate):** Do not rebuild the design system now. Adopt a written rule
  (CONTEXT.md): new/touched components use tokens + the custom CSS classes, no new inline
  style objects; fold inline styles into the stylesheet opportunistically when a file is
  already being edited (CF-17 does this for the worst 7 files).

---

## LOW

### CF-30 — Score badge band decided by integer rounding
- **Evidence:** `src/lib/postPerformanceScore.ts:303-308` rounds `overallScore` to an
  integer before the `>=7 High / >=5 Medium` bucketing (`464-467`): 6.5 → "High",
  6.49 → "Medium". (Weights sum to 1.0; no div-by-zero — the rest of the math is sound.)
- **Fix:** Bucket on the unrounded value (or keep one decimal).

### CF-31 — Autosave resurrects a draft for an already-saved calendar
- **Evidence:** `src/pages/Index.tsx:2191` clears the draft after save, but the autosave
  effect (`1035-1130`) doesn't know about `savedId`; the next edit re-creates a
  draft/server row for content already in `saved_calendars`, re-prompting "recovery" of a
  duplicate next session.
- **Fix:** Skip autosave while `savedId` is set for the current content.

### CF-32 — Multi-tab use silently clobbers wizard state
- **Evidence:** No `addEventListener("storage")` anywhere in `src/`; two tabs each write
  the whole `cf:wizard` blob, last writer wins. Compounded by CF-12's per-tab token.
- **Fix:** Accept and document the single-tab assumption in CONTEXT.md (a full cross-tab
  sync is out of proportion); CF-12's fix removes the mutual-destruction half.

### CF-33 — Consent screen fabricates a scope description when the server returns none
- **Evidence:** `src/pages/OAuthConsent.tsx:130-136` — empty `details.scopes` falls back
  to the hardcoded reassurance "Read your saved calendars and scheduled posts."
- **Fix:** Replace the fallback with a neutral, accurate line ("This app is requesting
  access to your account") — or block approval when no scopes are returned, once CF-09
  registers real scopes.

### CF-34 — MCP deploy-time footgun: RLS safety depends on `SUPABASE_PUBLISHABLE_KEY` truly being the anon key
- **Evidence:** `src/lib/mcp/tools/*.ts:5-10` — tools attach the caller's bearer token to
  a client built with `SUPABASE_PUBLISHABLE_KEY`. Correct as written (no service-role use
  anywhere in `src/lib/mcp`), but a mis-set env var would silently bypass RLS.
- **Fix:** One startup assertion in the MCP entry that the configured key is not a
  service-role key (they are distinguishable by prefix/claims). Nothing more.

### CF-35 — CalendarDetail uses a bare "Loading…" string
- **Evidence:** `src/pages/CalendarDetail.tsx:1750-1755` vs skeletons on MyCalendars
  (`:449`) and Schedule (`:538`).
- **Fix:** Reuse the existing skeleton pattern on the loading branch.

### CF-36 — Double error notification (inline card + toast) on Schedule and MyCalendars
- **Evidence:** `Schedule.tsx:181-183`, `MyCalendars.tsx:79-81` — `toast.error` fires for
  the same failure already rendered via `ErrorState`.
- **Fix:** Drop the toast where an inline `ErrorState` renders.

### CF-37 — InspirationBank: stale `as any` fallback and nonsense volume math
- **Evidence:** `src/components/InspirationBank.tsx:28-35` — TODO + `as any` claiming the
  store lacks `toggleTrendingTopic`, which it has (`useWizardStore.ts:79-88`); lines
  176/259 render `(t.posts / 100).toFixed(0)}k posts` — dividing a count by 100 and
  labeling it thousands.
- **Fix:** Remove the cast/fallback and use the typed store; render the volume as
  `Intl.NumberFormat` compact notation of the actual count.

### CF-38 — Dead footer social links
- **Evidence:** `src/components/landing/LandingFooter.tsx:16-18` — all `href: "#"`.
- **Fix:** Link real profiles or remove the icons until profiles exist.

---

## Execution order (dependency-aware)

**Wave 1 — trust & data safety (before any marketing push):**
CF-01, CF-12 (draft recovery actually works) → CF-02, CF-03, CF-04 (one shared
banned-content checker threaded through all five generation paths) → CF-06, CF-07, CF-15,
CF-16, CF-18 (GTM honesty cluster — mostly copy/data changes, low code risk).

**Wave 2 — make advertised pipelines real:**
CF-05 + CF-13 together (trends cron + platform gate), CF-08 (client trends respected),
CF-14 (delete dead pipeline in the same PR to end the ambiguity), CF-26, CF-27.

**Wave 3 — pipeline robustness & consent integrity:**
CF-09 + CF-33 (scopes registered and enforced), CF-10, CF-11, CF-24, CF-25, CF-23.

**Wave 4 — state-layer correctness:**
CF-19, CF-20, CF-21, CF-22, CF-31.

**Wave 5 — polish:**
CF-17, CF-28, CF-29, CF-30, CF-32, CF-34–CF-38.

Regression gate for every wave: `npm run test:run` green (baseline: 44 files / 366 tests
pass today), plus one manual generation pass (wizard → calendar → repurpose → schedule)
after Waves 1–3.

---

## Top three launch-blocking risks

1. **Commercial-trust cluster (CF-06, CF-07, CF-15, CF-16, CF-18).** The first-run screen
   and payment dialog carry a different brand than the site; landing prices are in the
   wrong currency with fictional tiers and features; "publishing" and "click/conversion
   analytics" are advertised but do not exist. Any one of these erodes checkout
   conversion; together they are a refund/chargeback and reputation risk on day one.
   These are also the *cheapest* fixes in the plan — copy and data-source changes.

2. **Brand safety is unenforced across every generation path (CF-02, CF-03, CF-04).**
   The product's core differentiator — "persists a unified brand voice, forbidden terms,
   hashtag policies" — enforces only hashtags. Banned words are discarded in transit;
   forbidden phrases are a prompt hint no output check backs up; two generation paths
   receive no brand context at all. For the agency/marketing-team buyer, one forbidden
   term in shipped copy is a fireable event.

3. **Two headline workflows are silent no-ops (CF-01/CF-12 and CF-05/CF-08/CF-13).**
   Draft auto-recovery's envelope layer deletes its own drafts on every mount, and the
   trends pipeline has an empty table, an unscheduled cron, and a server that discards the
   user's trend selections. Both features demo fine (Zustand persist masks the first; the
   AI-trends UI masks the second) and both fail exactly when the user relies on them —
   the worst kind of launch defect because it surfaces as user-reported data loss and
   "this feature does nothing" reviews, not as errors in monitoring.

---

## Assumptions documented and kept

1. **Repo-only audit surface.** Deployed state (which functions are live, whether any
   cron jobs were registered manually in the hosted DB, Supabase Auth OAuth server
   configuration including PKCE/redirect/token rotation) was assessed from migrations,
   `config.toml`, and source only. OAuth 2.1 mechanics are delegated to Supabase Auth's
   platform and cannot be verified from this codebase.
2. **"ContentForge" is the intended brand** (it is the exported `APP_NAME` and dominates
   user-facing surfaces); CF-06 fixes therefore normalize *to* ContentForge. If the
   decision goes the other way, the fix inverts but the issue stands.
3. **Pipeline A (`trends` table) is the intended trends architecture** and the
   underscore/`trending_topics` pipeline is abandoned — inferred from Pipeline A being the
   one wired into generation and created by an applied migration. CF-14 assumes deletion;
   if Pipeline B is the future, the deletions become the inverse.
4. **The `PlanSettings`/`_shared/plans.ts` INR tiers are the real commercial offer** (they
   are what the payment flow charges); landing pricing is treated as the erroneous side.
5. **No file was modified during the audit.** This document is the single artifact
   produced, created on explicit request.
