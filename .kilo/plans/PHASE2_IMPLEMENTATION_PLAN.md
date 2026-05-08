# Phase 2: Smart Content — Implementation Plan

**Date Started:** May 7, 2026  
**Estimated Duration:** 5–7 days  
**Goal:** Make AI smarter about India-specific and strategic content

---

## 📊 Phase 2 Tasks Breakdown

### Task 1: Post Performance Scoring (Medium Effort, Medium Impact)
**Priority:** 🔴 Must-Have (foundation for analytics)  
**Files to Create/Modify:**
- `src/lib/postPerformanceScore.ts` (new) — Scoring algorithm
- `src/components/PerformanceScoreCard.tsx` (new) — UI component
- `src/pages/Index.tsx` (modify Step 4)

**Features:**
- Hook strength rating (1-10): Opening line creates curiosity?
- Readability score (Flesch-Kincaid grade level)
- CTA effectiveness (1-10): Specific question or vague?
- Hashtag relevance (% of post-related hashtags)
- Overall post score (average of above)

**Implementation Steps:**
1. Write scoring algorithm (3 helper functions)
2. Create ScoreCard component with gauge/meter visual
3. Add "Performance" tab to Step 4 post details
4. Show score for active post, update on regeneration

---

### Task 2: India-Specific Content Intelligence (Medium Effort, High Impact)
**Priority:** 🟠 High (competitive advantage)  
**Files to Create/Modify:**
- `src/lib/indiaContent.ts` (new) — India data & helpers
- `supabase/functions/_shared/promptHelpers.ts` (modify) — Add India context
- `src/pages/Index.tsx` (modify Step 1 UI)

**Features:**
- Auto-detect India market (timezone, keywords)
- India-specific statistics source pool (NASSCOM, NITI Aayog, ICMR)
- Reference Indian cities, hospitals, schemes (PM-JAY, Ayushman Bharat, NHP)
- India-relevant hashtag suggestions
- Western-centric framing detection + Indian reframing suggestion

**Implementation Steps:**
1. Build India data module (cities, hospitals, stats sources, schemes)
2. Create `buildIndiaContext()` helper for prompts
3. Add India checkbox/toggle to Profile page
4. Modify prompt layer to include India context when enabled
5. Add India hashtag suggestions in Step 1

---

### Task 3: Tone Consistency Checker (Medium Effort, Medium Impact)
**Priority:** 🟡 Medium (polish feature)  
**Files to Create/Modify:**
- `src/lib/toneAnalysis.ts` (new) — Analysis algorithm
- `src/components/ToneConsistencyPanel.tsx` (new) — UI
- `src/pages/Index.tsx` (modify Step 4 sidebar)

**Features:**
- Detect voice drift between posts (7-post analysis)
- Flag contradictory claims across week
- CTA repetition detection (e.g., 4 posts say "share your thoughts")
- Suggest post-specific tweaks to improve cohesion
- "Week cohesion score" (1-10)

**Implementation Steps:**
1. Build tone analysis functions (voice extraction, CTA parsing)
2. Create ToneConsistencyPanel component
3. Add panel to Step 4 sidebar (alternates with week summary)
4. Update on regeneration
5. Add suggestions for low-cohesion posts

---

### Task 4: Topic Inspiration Bank (Low Effort, Medium Impact)
**Priority:** 🟢 Nice-to-Have (but easy, high engagement)  
**Files to Create/Modify:**
- `src/lib/trendingTopics.ts` (new) — Topic data
- `src/components/InspirationBank.tsx` (new) — UI component
- `src/pages/Index.tsx` (modify Step 2 UI)

**Features:**
- Show 5–7 trending topics per industry
- Curated weekly (or mock data for now)
- Click to add topic to selection
- Filter by industry
- "Last updated" timestamp

**Implementation Steps:**
1. Create mock trending topics dataset (per industry)
2. Build InspirationBank component
3. Add to Step 2 (Topics selection)
4. Wire click-to-add functionality
5. Future: API endpoint for live trending data

---

### Task 5: Smart Posting Time Optimization (✅ Already Done)
**Status:** Complete  
**Files:** `src/lib/postingTimes.ts` (done in Phase 1)  
**Verified:** Per-day optimized times (Mon 08:00 → Sun 18:00)

---

## 🎯 Implementation Order

1. **Day 1–2:** Post Performance Scoring
   - High engagement (users see instant feedback)
   - Moderate complexity (3 scoring functions)
   - Foundation for future analytics

2. **Day 2–3:** Topic Inspiration Bank
   - Lowest complexity (mostly UI + mock data)
   - Quick win (high visible impact)
   - Preps for Phase 3 API integration

3. **Day 3–5:** India-Specific Content Intelligence
   - Highest impact (competitive advantage)
   - Medium complexity (data layer + prompt modification)
   - Requires testing with Indian users

4. **Day 5–6:** Tone Consistency Checker
   - Medium complexity (analysis algorithm)
   - Polish feature (improves week quality)
   - Nice-to-have but valuable

---

## 📝 Success Metrics (Post-Phase 2)

- Users see performance scores before copying posts
- India market users report more relevant content
- Week summary includes cohesion score
- Trending topics visible in Step 2 (adoption rate)
- No regressions in generation speed
- <500ms additional latency for analysis

---

## 🚀 Phase 2 Quick Start

**Starting with:** Post Performance Scoring (Task 1)

1. Create `src/lib/postPerformanceScore.ts` with scoring functions
2. Create `src/components/PerformanceScoreCard.tsx` with visualization
3. Integrate into Step 4 post details (new tab or section)
4. Test with various post types

**Next:** Will implement other tasks in sequence

---

## Files Created in Phase 2

- [ ] `src/lib/postPerformanceScore.ts`
- [ ] `src/components/PerformanceScoreCard.tsx`
- [ ] `src/lib/indiaContent.ts`
- [ ] `src/lib/toneAnalysis.ts`
- [ ] `src/components/ToneConsistencyPanel.tsx`
- [ ] `src/lib/trendingTopics.ts`
- [ ] `src/components/InspirationBank.tsx`

**Files Modified in Phase 2**
- [ ] `supabase/functions/_shared/promptHelpers.ts`
- [ ] `src/pages/Index.tsx` (multiple integrations)
- [ ] `src/pages/Profile.tsx` (India toggle)

---

## Phase 2 Status Tracker

| Task | Status | Files | ETA |
|------|--------|-------|-----|
| Post Performance Scoring | ⏳ Starting | 2 new, 1 mod | 6h |
| Topic Inspiration Bank | 📋 Queued | 2 new, 1 mod | 4h |
| India Content Intelligence | 📋 Queued | 2 new, 2 mod | 8h |
| Tone Consistency Checker | 📋 Queued | 2 new, 1 mod | 6h |
| **Total** | **⏳ In Progress** | **8 new, 4 mod** | **24h** |

---

**Next Action:** Start implementing Post Performance Scoring
