# 🗺️ ContentForge Enhancement Roadmap — Execution Plan

> Derived from the gap analysis of `docs/ONE_PAGER.md` (2026-07-08). This is a planning
> document only — no schema, API contract, or code decisions are locked in here.
> Effort signals assume one experienced engineer on the existing stack
> (React 18 + TS, Zustand, TanStack Query, Supabase Edge Functions).

---

## Goals

1. Convert passive assets (topic-gap badges, `trends` table, brand rules) into active creation and quality steps.
2. Close the "Analytics Black Box" with data the app already collects, before any external platform APIs.
3. Position for the two big bets — direct publishing and closed-loop learning — without blocking near-term wins on them.

**Success metrics (from the one-pager):** −30% time-to-schedule, 15% free-to-paid conversion, NPS 40+ on the wizard.

---

## Phase 1 — Activate what exists (~2 weeks)

Cheapest cluster, highest leverage. Each item turns an existing read-only feature into an action.

### 1.1 One-click Gap Fill (2–4 days)
- **Extends:** Topic Gap Detection + AI Calendar Wizard.
- **Build:** each gap badge gets a "Generate post for this theme" action that invokes the existing post-generation edge function with the missing category as the brief seed; result lands in the calendar as a draft.
- **User problem:** detection without remediation still leaves the blank screen.
- **Done when:** a user can go from badge → scheduled draft without typing a brief.

### 1.2 Trend-to-Post (3–5 days)
- **Extends:** Trend Ingestion Pipeline (`trends-read`) + AI Calendar Wizard / composer.
- **Build:** surface trends in the composer and wizard with a "Draft from this trend" action feeding the generator; completes the loop the one-pager promises ("inform what to create next").
- **User problem:** trends sit in a table; users get no creation leverage from data the cron already ingests.
- **Done when:** trends appear in the creation flow and each can seed a draft in one click.

### 1.3 Brand-compliance scoring dimension (2–3 days)
- **Extends:** Quality Variant Scoring + Brand Memory Database.
- **Build:** check drafts against stored forbidden terms and hashtag policies as a fourth score alongside hook/CTA/readability, with inline violation flags.
- **User problem:** brand rules are stored but nothing enforces them at draft time.
- **Done when:** a draft containing a forbidden term is visibly flagged before scheduling.

### 1.4 Trend-aware gap badges (2–3 days)
- **Extends:** Topic Gap Detection + Trend Ingestion Pipeline.
- **Build:** cross-reference gap categories against the `trends` table so badges can rank "underrepresented **and** trending now" first.
- **User problem:** all gaps look equally urgent; users need a reason to fill one before another.
- **Done when:** badges carry a trend signal and sort by it.

---

## Phase 2 — Retention & quality (~2–3 weeks)

Deepens the daily workflow; protects work and teaches the user.

### 2.1 Persistent idea backlog (3–4 days)
- **Extends:** Source-to-Post Repurposing (`extract-ideas`).
- **Build:** save extracted angles to a per-user backlog (same persistence pattern as `wizard_drafts`), surfaced in the calendar as fill candidates.
- **User problem:** paste a transcript, get 10 angles, expand 3, lose 7.

### 2.2 Score explanations + targeted rewrite (3–5 days)
- **Extends:** Quality Variant Scoring + inline rewrite edge function.
- **Build:** each scoring card explains *why* a dimension is low and offers a one-click fix scoped to that dimension ("strengthen the hook").
- **User problem:** a number without a reason doesn't teach anything; the P2 backlog already flags the heuristics as weak.

### 2.3 Draft version history (2–3 days)
- **Extends:** Draft Auto-Recovery (`wizard_drafts` + Zustand `persist`).
- **Build:** keep the last N snapshots with a restore picker instead of only the latest autosave.
- **User problem:** auto-recovery protects against crashes but not the user's own bad edit or a stale device overwrite.

### 2.4 URL ingestion for Source-to-Post (2–3 days)
- **Extends:** Source-to-Post Repurposing (`extract-ideas`).
- **Build:** accept a URL, fetch and strip the article server-side (thin new edge function), pipe text into `extract-ideas`.
- **User problem:** most source material lives at a URL; pasting 20k characters is needless friction.

---

## Phase 3 — Velocity & monetisation (~3–4 weeks)

Bigger items tied to the stated business levers.

### 3.1 Bulk calendar repurposing (4–6 days)
- **Extends:** Multi-Channel Repurposing edge function.
- **Build:** "repurpose this whole week to X/Instagram" as one action, fanning out per post with a progress/review screen.
- **User problem:** the stated value is "10x faster cross-posting velocity," but post-at-a-time repurposing caps that well below 10x for a 7-post week.

### 3.2 In-app engagement telemetry → hook/CTA insights (5–8 days)
- **Extends:** Analytics & Logs tables + telemetry edge function + Quality Variant Scoring.
- **Build:** insights view showing which hooks/CTAs users keep, discard, or regenerate most — using data already collected, no external platform APIs.
- **User problem:** directly attacks the "Analytics Black Box" problem statement.

### 3.3 Brand slots management (5–8 days)
- **Extends:** Brand Memory Database.
- **Build:** first-class UI for multiple brand profiles per account with per-calendar brand selection.
- **User problem:** agencies and multi-product founders can't separate voices; "custom brand slots" is a named conversion lever with no surface today.

### 3.4 MCP tool coverage for the full workflow (4–6 days)
- **Extends:** MCP server + OAuth 2.1 consent flow.
- **Build:** expose extract-ideas, repurposing, and trends-read as MCP tools so external agents can run end-to-end flows.
- **User problem:** agents can connect but can only touch a slice of the workflows, underdelivering on the OAuth investment.

---

## Strategic Bets (post-Phase 3, sequenced deliberately)

### Bet 1 — Direct publishing connectors (detailed)
The one-pager's diagram shows a "Timezone-Aware Publisher," but the edge-function list contains
nothing that *posts* anywhere, and the success metric is time-to-**schedule**. Users copy-paste out,
reintroducing platform inconsistency at the last mile. Biggest promise/capability gap in the product.
(Roadmap Future Work lists platform-native analytics *integrations* — not publishing — so this is not
already covered.)

**Reality check (verified 2026-07):** platforms don't forbid third-party posting — they gate it.
Each has an official write API behind app review, account-type restrictions, or per-post fees:

| Channel | Path | Gate | Notes |
| :--- | :--- | :--- | :--- |
| Newsletter / Blog | ESP + CMS APIs (e.g. Resend, WordPress, Ghost) | None | Open APIs; easiest connectors. |
| LinkedIn | `w_member_social` (member) / Community Management API (org pages) | Dev Tier → Standard Tier approval; registered-business only | Form-and-wait, not a signup; need legal name, website, privacy policy. |
| Instagram | Graph API two-step publish (`/media` → `/media_publish`) | Meta App Review + Advanced Access, ~2–4 weeks | **Professional accounts linked to a FB Page only** — onboarding must say so. |
| Facebook | Pages API (`pages_manage_posts`) | Same Meta app review as Instagram | Pages only, never personal profiles; one review covers both channels. |
| X (Twitter) | API v2, pay-per-use (since Feb 2026) | ~$0.015/post, **$0.20/post with a link**; no free tier for new devs | Technically easy; a unit-economics decision, not an engineering one. |

**Staged rollout — sequence by friction, not audience size.** Each stage ships value on its own;
later stages are optional until demand proves them.

- **Stage 0 — file the paperwork (~1 day, then wait):** submit the Meta App Review and LinkedIn
  Community Management applications immediately — they are the long pole (weeks). Request the
  **comment read/write scopes in the same applications** so Bet 4 doesn't need a second review.
- **Stage 1 — newsletter + blog connectors (3–5 days):** no gatekeeper; gives us a real
  "Publish" button, the connector UI pattern, and the publish-status model that every later
  channel reuses. Ships while approvals are pending.
- **Stage 2 — LinkedIn member posting (3–5 days after approval):** highest-value channel for the
  stated audience (creators, marketing teams, agencies); OAuth connect + publish + status.
- **Stage 3 — Meta (Instagram + Facebook Pages) (5–8 days after approval):** one Meta app covers
  both. Onboarding must handle the professional-account/linked-Page requirement explicitly.
- **Stage 4 — X: decide, don't default (0 days until decided):** per-post fees ($0.20 with a
  link) must be priced into the paid tier or passed through. Ship only if user demand and
  pricing model support it; "copy to clipboard, formatted for X" remains the fallback.

**Deliberately deferred — do not build until the trigger fires:**
- *Aggregator escape hatch (e.g. Ayrshare):* only if approvals stall past ~6 weeks or we want
  a demand test before native builds. Don't run aggregator + native in parallel.
- *X connector:* until pricing supports the per-post cost (see Stage 4).
- *Retry queues, partial-failure orchestration, per-platform preview rendering:* start with
  publish → confirm → surface errors plainly (per the app's loading/error-state rule);
  add machinery only when real failure patterns demand it.
- *Organization-page LinkedIn posting:* member posting first; org pages when an agency asks.

**On the right track when:** Stage 1 users stop copy-pasting newsletters out, and LinkedIn
connect-rate after Stage 2 shows >30% of active users linking an account. If neither happens,
stop before Stage 3 and re-examine demand rather than adding channels.

### Bet 2 — Closed-loop performance learning
Once real engagement data exists (via Bet 1 or the roadmap's analytics integrations), feed actual
performance back to recalibrate scoring weights and auto-suggest Brand Memory updates. The roadmap's
analytics item would *display* data; this bet makes the generation engine *consume* it — the real
answer to the Analytics Black Box, and the moat copy-paste schedulers can't match.

### Bet 3 — First-party autopilot agent
The MCP + OAuth work exists for *external* agents, but ContentForge ships no agent of its own.
A weekly autopilot (reusing the trend-cron pattern) drafting a proposed calendar from Brand Memory +
trends + topic gaps, delivered for human approval. None of the eight workflows is proactive today.
Depends on Phase 1 (gap fill, trend-to-post) and 3.4 (workflow-complete tooling).

### Bet 4 — Comment engagement & reply copilot
Once posts publish through Bet 1's platform connections, ingest the comments they receive
(positive and negative), and offer an in-app **reply action**: AI-drafted responses in the user's
Brand Memory voice, with tone matched to the comment's sentiment (thank an advocate, de-escalate a
critic, answer a question) — the same graceful-fallback and forbidden-terms rules apply to replies
as to posts. Beyond replying, comment sentiment and themes become a learning signal: which topics,
hooks, and formats draw engagement vs. pushback per audience, feeding Bet 2's loop so future
calendars are tailored to what followers actually respond to. None of the eight workflows touches
post-publication conversation today — the product's involvement currently ends at the schedule.
**Depends on:** Bet 1 (platform OAuth + comment read/write APIs); Brand Memory for reply voice;
extends the inline rewrite pattern for tone-adjusting a drafted reply before sending.

**Recommended bet order:** 1 → 4 → 2, with 3 buildable in parallel after Phase 1.
Bet 4 sits between them deliberately: it needs Bet 1's connections, and its sentiment data is the
richest input Bet 2 can get.

---

## Dependencies & sequencing notes

- 1.4 depends on nothing in 1.2 but shares the `trends-read` surface — build 1.2 first to reuse the UI.
- 3.2 (in-app insights) is the on-ramp to Bet 2; don't skip it to jump straight to platform analytics.
- Bet 3 consumes Phase 1 items as its tool surface; shipping it earlier means an agent with nothing to drive.
- Bet 1 Stage 0 (filing platform applications) can start **today**, before any Phase 1 work —
  it costs a day and the review clock runs in parallel with everything else.
- Bet 4 is gated hard on Bet 1 — there is no comment data without platform connections. Its
  comment scopes are requested in Bet 1's Stage 0 applications to avoid a second review. Its reply
  drafting reuses Brand Memory + the inline rewrite pattern, so it's mostly integration work once
  connectors exist; its sentiment output is the primary feed for Bet 2.
- Per repo rules: run `feature-planner` before implementing any item, keep RLS on every new table
  (idea backlog, draft snapshots, brand slots), and verify with `npm run test:run` before completion.

## Founder summary

The three highest-leverage moves: (1) spend ~2 weeks in Phase 1 making the badges, trends table, and
brand rules *do* things instead of just displaying things; (2) commit to direct publishing connectors
as the first strategic bet, because the product currently generates and schedules but cannot post;
(3) once posts flow through your own pipes, own the conversation too — AI-drafted, brand-voice
comment replies — and feed that engagement and sentiment back into scoring and brand memory so
the product gets smarter with use.
