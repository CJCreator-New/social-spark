# Competitor Analysis & Implementation Roadmap (June 2026)

## 1. Competitive Snapshot

| Tool | Entry Price | AI Generation | Brand Voice | Approval Workflows |
|---|---|---|---|---|
| Buffer | Free / $5-10 per channel | AI Assistant (GPT-4), unlimited, all plans | Tone presets only | Team plan: unlimited members, approvals |
| Hootsuite | $99-399/mo | OwlyWriter + "OwlyGPT" (brand voice, image gen, beta) | Yes - brand voice personalization | Team/Advanced tiers |
| Sprout Social | $79-399/mo | AI Assist - tone controls, send-time ML, sentiment | Tone controls, no deep brand memory | Professional+: approval; Advanced: multi-step + CRM |
| Later | $25-110/mo | Credit-gated, captions only, weak | None | Not a focus |
| Vista Social | $79-349/mo | "AI training" on brand content, unlimited on Advanced | Yes - AI training/grounding | Advanced tier |
| Publer | Free / $12-21/mo | GPT-4 + DALL-E, Business tier only | Minimal | Minimal |
| Lately.ai | $119-199/mo | Repurposing engine learns voice from engagement data | Learned from engagement | N/A |

Pricing/feature claims sourced from aggregator sites (Blotato, CreateSocial, Ampifire, PostFast, CostBench, eesel.ai, SocialRails) - broadly consistent but should be spot-checked against vendor pages before external use. Hootsuite "OwlyGPT" and Vista "AI training" are single-source, treat as unconfirmed.

## 2. Feature Gaps

### Missing entirely

- **Best-time-to-post heuristic** - Later's core differentiator. Medium effort using existing analytics data.
- **Topic Gap Detection** - marketed but not implemented. `trends_ingest`/`trends_read`/`trends_admin` functions exist and are unused - natural foundation.

### Implemented but weak/shallow
- **Brand memory** (`supabase/functions/_shared/promptHelpers.ts`) - static rule-based config (voice, tone, banned phrases, hashtag policy). Competitors (Vista Social, Lately) ground generation in actual brand content/engagement history. Opportunity: RAG-lite - embed exemplar brand posts, retrieve at generation time.
- **Quality scoring** (`src/lib/postPerformanceScore.ts`, server-side `scoreVariants`) - solid heuristic + LLM-judge, but criteria are static/generic vs. competitors tying scoring to per-account historical engagement.
- **Repurposing** (`supabase/functions/repurpose-post`) - single-step. 2026 trend is agentic multi-step pipelines (atomize -> N platform variants -> score -> schedule).
- **Trend awareness** - `trends_ingest`/`trends_read` ingested but never feed generation prompts. Trend-timed content gets 2-3x reach per 2026 research.

### Implemented but not exposed in UI
- **Trend ingestion pipeline** - wire `trends_read` into the calendar wizard as a "Trending topics" suggestion panel before generation.
- **LLM-judge variant scoring** - `scoreVariants` runs server-side but its rationale/score isn't shown in the variant picker alongside the heuristic score.

## 3. Prioritized Roadmap (highest ROI first)

1. ✅ **Wire `trends_read` into generation prompts** (`promptHelpers.ts`) - DONE
   `getTrendingTopics()` queries `trending_topics` and is injected into the strategic prompt framework for both calendar and single-post generation.

2. ✅ **Orchestrate repurposing as a pipeline** - DONE
   `repurposeTo()` in `CalendarDetail.tsx` now chains repurpose -> client-side performance scoring (`PerformanceScoreCard`, shown in the repurpose modal) -> `generate-post-image` for a cover image, with stage progress shown to the user ("rewriting" / "scoring" / "illustrating"). Implemented as an extension of the existing single-target modal rather than a new async job-orchestration system (no new tables/RLS/Realtime), keeping the change scoped while delivering the "one action -> scored, illustrated repurposed variant" outcome.

3. ✅ **Surface LLM-judge scores in the variant picker UI** - DONE (already implemented prior to this roadmap)

4. ✅ **Brand memory RAG-lite** - DONE
   `selectRelevantExamples()` in `promptHelpers.ts` does keyword/Jaccard-overlap matching to pick the most relevant brand exemplars (up to 3) from a larger pool (Profile now allows up to 20 saved examples) for each generation.

5. **Team approval workflows** - new `post_approvals` table + RLS roles + review queue. High effort, high impact, longer-term (B2B/agency tier).
   **Status: deferred.** Social Spark's current data model is single-owner (`user_id`-scoped tables, no teams/workspaces/roles). Approval workflows require designing a foundational multi-user/team model first (new tables, RLS redesign, invites, possibly billing implications) - a major architectural decision that needs its own planning session before implementation.

6. ✅ **Best-time-to-post heuristic** - DONE
   `src/lib/postingTimes.ts` now has platform-specific posting time tables (LinkedIn, Instagram, X, Facebook, TikTok) with reasons per slot, consumed via `suggestedTimeForDay(day, platform)` across the wizard, calendar detail, and ICS export.

## 4. Positioning Note
Social Spark's BYO-key support (OpenAI/Anthropic/OpenRouter) plus Gemini via Lovable Gateway is a real multi-model architecture differentiator - none of the listed competitors offer true BYO-key pass-through. This is a positioning opportunity, not a build task.

## Extension Points
- `supabase/functions/_shared/promptHelpers.ts` - trend injection, brand memory RAG
- `supabase/functions/repurpose-post`, `generate-post-image` - pipeline chain
- `src/lib/postPerformanceScore.ts` - judge-score UI surfacing, scoring enhancements
- `src/stores/` - calendar wizard trend-suggestion panel, pipeline job status
- `trends_ingest`, `trends_read`, `trends_admin` Edge Functions - currently dormant
