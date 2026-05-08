# ContentForge Enhancement Roadmap

**Last Updated:** May 7, 2026  
**Current Status:** Phase 2 (Smart Content) — In Progress  
**Already Shipped:** LinkedIn preview, sub-topic confirmation, smart posting times, auto-strip markdown, platform-aware enforcement, week summary, batch edit, drag reorder, undo/redo, diff view

---

## 📊 Enhancement Inventory

**Total Enhancements:** 30  
**Must-Have:** 4 (Very High Priority)  
**High Priority:** 5 (Release Soon)  
**Medium Priority:** 11 (Next Quarters)  
**Nice-to-Have:** 10 (Future / Low ROI)

---

## 🎯 Phase-Based Roadmap

### **PHASE 1: FOUNDATION (This Sprint — 3–5 days)**
*Goal: Lock down core UX and workflow improvements*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 15 | Batch Edit Across All 7 Posts | High | Medium | ⬜ Ready |
| 13 | Drag-and-Drop Day Reordering | Medium | Low | ⬜ Ready |
| 16 | Undo / Redo History (5 levels) | High | Medium | ⬜ Ready |
| 14 | Show Before/After Diff View on Tweak | Medium | Low | ⬜ Ready |

**Why This Phase First?**
- Users spend 80% of time in Step 4 editing/tweaking posts
- These are all QoL improvements that reduce friction
- Low architectural complexity; mostly UI/state management
- Foundation for Phase 2 integrations

**Estimated Timeline:** 3–5 days  
**Files to Modify:** `src/pages/Index.tsx`, `src/hooks/` (custom hooks for undo/redo)

---

### **PHASE 2: SMART CONTENT (Next Sprint — 1 week)**
*Goal: Make the AI smarter about India-specific and strategic content*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 3 | Smart Posting Time Optimization | High | Low | ✅ Done |
| 5 | Post Performance Scoring Before Publishing | Medium | Medium | ⬜ Ready |
| 8 | India-Specific Content Intelligence | High | Medium | ⬜ Ready |
| 9 | Tone Consistency Checker Across 7 Posts | Medium | Medium | ⬜ Ready |
| 17 | Topic Inspiration Bank (Trending Topics) | Medium | Low | ⬜ Ready |

**Why This Phase?**
- Differentiates ContentForge from generic AI writers
- India market is a key audience; competitive advantage
- Builds on existing prompt layer infrastructure
- Medium effort, high perceived value

**Estimated Timeline:** 5–7 days  
**Files to Modify:** `supabase/functions/_shared/promptHelpers.ts`, `src/lib/`, new India-specific data module

---

### **PHASE 3: INTEGRATION LAYER (Weeks 2–3)**
*Goal: Connect ContentForge to external platforms*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 18 | Direct LinkedIn Integration (OAuth) | Very High | High | ⬜ Ready |
| 20 | Recurring Weekly Content Templates | High | Medium | ⬜ Ready |
| 19 | Calendar View (Grid) for Schedule Page | High | Medium | ⬜ Ready |

**Why This Phase?**
- OAuth is the gateway to enterprise use cases
- Templates enable repeat-customer retention
- Calendar grid provides better UX for Schedule page
- Requires external API integration planning

**Estimated Timeline:** 10–14 days  
**Files to Modify:** `src/pages/Schedule.tsx`, `src/integrations/`, new OAuth module  
**External Dependencies:** LinkedIn API, OAuth provider setup

---

### **PHASE 4: PROFILE & PERSONALIZATION (Week 4)**
*Goal: Make ContentForge learn and adapt to user voice*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 21 | Persona / Brand Kit Builder | High | Medium | ⬜ Ready |
| 22 | Audience Persona Library | Medium | Medium | ⬜ Ready |
| 4 | Content Pillar / Theme Planner | Medium | Medium | ⬜ Ready |

**Why This Phase?**
- Enables voice consistency across weeks
- Foundation for analytics (Phase 5)
- Medium effort, high user retention value

**Estimated Timeline:** 7–10 days  
**Files to Modify:** `src/pages/Profile.tsx`, new database schema for brand kits

---

### **PHASE 5: COLLABORATION & TEAMS (Month 2)**
*Goal: Enable team workflows and multi-client management*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 24 | Team / Agency Workspace | High | Very High | ⬜ Scoped |
| 25 | Comments & Annotations on Posts | Medium | Medium | ⬜ Scoped |

**Why This Phase?**
- Unlocks B2B / agency use cases
- Highest effort; requires data model redesign
- Requires role-based access control (RBAC)

**Estimated Timeline:** 14–21 days  
**Files to Modify:** `supabase/migrations/`, auth layer, new team schema

---

### **PHASE 6: ANALYTICS & FEEDBACK LOOP (Month 2–3)**
*Goal: Close the loop from generation to performance*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 23 | Content Performance Feedback Loop | High | Very High | ⬜ Scoped |
| 29 | Content Variety Analyzer | Medium | Medium | ⬜ Scoped |
| 30 | Historical Calendar Comparison | Medium | Low | ⬜ Scoped |

**Why This Phase?**
- Requires LinkedIn API integration to work
- Foundation for machine learning personalization
- Very high effort but highest long-term ROI

**Estimated Timeline:** 21–28 days  
**Files to Modify:** New analytics dashboard, `supabase/functions/` (data ingestion)

---

### **PHASE 7: COMPLIANCE & QUALITY (Month 3)**
*Goal: Ensure content safety and credibility*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 7 | Source Citation / Stat Verification Layer | Medium | High | ⬜ Scoped |
| 11 | Persistent Global Navigation | Low | Low | ⬜ Scoped |

**Why This Phase?**
- Lower priority for initial launch
- Requires fact-checking API integration
- Medium-to-high effort

**Estimated Timeline:** 7–14 days  
**Files to Modify:** All page templates, new citation system

---

### **PHASE 8: NO-CODE AUTOMATION (Month 3–4)**
*Goal: Enable power users without custom code*

| # | Enhancement | Impact | Effort | Status |
|---|---|---|---|---|
| 26 | API Access for Power Users | Medium | High | ⬜ Scoped |
| 27 | Zapier / Make.com Integration | Medium | High | ⬜ Scoped |
| 28 | Export to Notion, Google Docs, Airtable | Medium | Medium | ⬜ Scoped |

**Why This Phase?**
- Enables automation workflows for agencies
- High effort; requires REST API design
- Medium impact; niche but powerful

**Estimated Timeline:** 14–21 days  
**Files to Modify:** New `/api/` endpoints, integration modules

---

## 📋 Phase 1 Detailed Breakdown

### **Task: Batch Edit Across All 7 Posts**

**Acceptance Criteria:**
- [ ] Add "Batch edit all" button in Step 4 bottom bar
- [ ] Modal opens with fields: brand mention, hashtag, CTA style, posting times
- [ ] Changes apply to all 7 posts at once
- [ ] Toast confirms: "Applied to 7 posts"
- [ ] Undo support works for batch operations

**Implementation Checklist:**
- [ ] Create `BatchEditModal` component
- [ ] Add state for batch edit payload
- [ ] Write `applyBatchEdit()` reducer function
- [ ] Add toast notification on success
- [ ] Integrate into Step 4 bbar

**Effort:** 4–6 hours  
**Files:** `src/pages/Index.tsx`, new `src/components/BatchEditModal.tsx`

---

### **Task: Drag-and-Drop Day Reordering**

**Acceptance Criteria:**
- [ ] Users can drag day cards to reorder (Mon → Fri positions)
- [ ] Day data swaps but topic doesn't regenerate
- [ ] Visual feedback during drag (opacity, shadow)
- [ ] Works on mobile (touch support)
- [ ] Undo/redo support

**Implementation Checklist:**
- [ ] Install `react-beautiful-dnd` or use native drag API
- [ ] Add reorder state to calendar
- [ ] Update day rendering with drag handles
- [ ] Write `swapDays()` utility function
- [ ] Test on mobile

**Effort:** 3–4 hours  
**Files:** `src/pages/Index.tsx`, `src/lib/utils.ts`

---

### **Task: Undo / Redo History (5 levels)**

**Acceptance Criteria:**
- [ ] Ctrl+Z undoes last edit to any post
- [ ] Ctrl+Y redoes last undone edit
- [ ] 5 levels of history maintained per post
- [ ] History clears when user generates new calendar
- [ ] Toast shows "Undo: [previous action]"

**Implementation Checklist:**
- [ ] Create `useUndoRedo()` custom hook
- [ ] Track history as stack of post snapshots
- [ ] Add keyboard event listeners (Ctrl+Z, Ctrl+Y)
- [ ] Wire into post edit handlers
- [ ] Add toast feedback

**Effort:** 5–7 hours  
**Files:** New `src/hooks/useUndoRedo.ts`, `src/pages/Index.tsx`

---

### **Task: Before/After Diff View on Tweak**

**Acceptance Criteria:**
- [ ] When user applies a tweak (Make shorter, etc.), show side-by-side diff
- [ ] Highlight added/removed text in diff view
- [ ] Show character count delta: "−12 chars, +5 words"
- [ ] Diff modal appears instead of silent update
- [ ] "Accept" or "Revert" options

**Implementation Checklist:**
- [ ] Create `DiffView` component
- [ ] Implement text diff algorithm (or use `diff-match-patch`)
- [ ] Show before/after with highlighting
- [ ] Add char/word count delta display
- [ ] Wire into regeneration flow

**Effort:** 4–5 hours  
**Files:** New `src/components/DiffView.tsx`, `src/pages/Index.tsx`

---

## 🎬 How to Execute Phase 1

1. **Day 1–2:** Implement batch edit + modal
2. **Day 2–3:** Add drag-and-drop reordering
3. **Day 3–4:** Build undo/redo hook and wire in
4. **Day 4–5:** Add diff view and test across all features

**Testing:**
- Manual test all 4 features in combination
- Check undo/redo works with batch edit
- Verify drag works with new post states
- Mobile responsiveness check

**Deployment:**
- Feature flag batch edit behind `FEATURE_BATCH_EDIT`
- Roll out to 20% of users first week
- Monitor error logs for undo/redo edge cases

---

## 🚀 Success Metrics (Post-Phase 1)

- **Engagement:** Average time in Step 4 should stay same or decrease (fewer clicks to make changes)
- **Error Rate:** Undo/redo should reduce user frustration; measure via support tickets
- **Adoption:** Batch edit should be used in 30%+ of generated calendars
- **Performance:** No regression in component render times

---

## 💡 Quick Wins (Can Do Today)

If you want quick validation before Phase 1:

1. **Add keyboard shortcut legend** (Ctrl+Z, Ctrl+Y) in Step 4 footer — 1 hour
2. **Add "Batch edit" button skeleton** with modal (non-functional) — 2 hours
3. **Add before/after modal** (just show static diff for one example) — 1.5 hours

These give users visibility into what's coming without full implementation.

---

## 📞 Phase 1 Start Point

**Ready to begin Phase 1?**

Next action: Start with Batch Edit modal in `src/pages/Index.tsx` around line 2230 (near bbar).
- Create `BatchEditModal` component
- Add "Apply to all" button
- Wire modal state into generateCalendar flow

Let me know when you're ready to dive in!
