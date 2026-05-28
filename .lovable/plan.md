# App Enhancement Plan

Building on the completed work (DB hardening, admin gating, single-day generation, scheduling, ICS export), here are the next high-impact enhancements grouped by theme.

---

## Completed Set

These items are now implemented and validated in the app:

- Public entry flow refresh: [Landing](../src/pages/Landing.tsx), [Auth](../src/pages/Auth.tsx), [ResetPassword](../src/pages/ResetPassword.tsx), and [NotFound](../src/pages/NotFound.tsx)
- Operational workspace polish: [MyCalendars](../src/pages/MyCalendars.tsx), [Schedule](../src/pages/Schedule.tsx), and [Profile](../src/pages/Profile.tsx)
- UX planning groundwork: frontend-design agent/skill added and the app-wide UI/UX roadmap captured below
- Validation: touched pages were checked with `get_errors` and came back clean

- Core creation workspace redesign: [Index](../src/pages/Index.tsx) — guided creation workspace, hero summary, persistent autosave, clearer stepper, and compact review panel (completed)
- Calendar review workspace refresh: [CalendarDetail](../src/pages/CalendarDetail.tsx) — review-first hero, active-day summary, grouped actions, improved analytics chrome (completed)
- Admin shell visual alignment: [Admin](../src/pages/Admin.tsx) — branded admin shell, last-updated summary, and cohesive badges to match product language (completed)

---

## Theme 1 — User Productivity (highest ROI)

### 1.1 Brief Templates ("Save & Load")
Save successful wizard configurations as reusable presets so users don't re-type voice/audience/goals every time.
- New `brief_templates` table (per-user, RLS-scoped)
- "Save as template" button at wizard review step
- "Load template" dropdown on wizard step 1
- Manage list (rename/delete) in Profile

### 1.2 Draft Auto-Recovery
Wire the existing `DraftRecoveryDialog` into `Index.tsx`:
- Debounced autosave to localStorage on form change
- On mount, prompt to restore drafts <24h old
- Prevents losing work after refresh/crash

### 1.3 Scheduled-Post Row Actions
Add row-level menu in `Schedule.tsx`:
- Cancel, Reschedule, Mark Published
- Uses existing `workflow_status` enum + `scheduled_at` column

### 1.4 Bulk Operations on Calendars/Posts
- Multi-select on `MyCalendars` and `Schedule`
- Bulk delete, bulk reschedule, bulk export

---

## Theme 2 — Personalization & Profile

### 2.1 Avatar Upload
File picker on Profile → uploads to existing `avatars` bucket → updates `profiles.avatar_url`. Image preview, 2 MB cap, png/jpeg/webp.

### 2.2 Default Preferences UX
The `profiles` table already has `default_voice`, `default_style`, `default_audiences`, `default_goals`, `banned_hashtags`, `required_hashtags`, `default_timezone` — but the Profile UI doesn't fully expose them. Build a clean settings page so wizards pre-fill from defaults.

### 2.3 Onboarding Flow
First-login walkthrough: pick industry, voice, audience → seeds defaults → drops user into wizard with sample brief.

---

## Theme 3 — Content Quality

### 3.1 Post Insights Panel
`postInsights.ts` exists but isn't surfaced. Show per-post: readability, hook strength, hashtag balance, length vs target — on the CalendarDetail card.

### 3.2 Regenerate-with-Feedback
Inline thumbs-down on any post → opens a small "what to fix" prompt → calls `regenerate-post` with user feedback merged into the prompt.

### 3.3 Hashtag Library
Reuse `banned_hashtags` / `required_hashtags` from profiles, plus a "trending in your industry" suggestion list pulled from past calendars.

### 3.4 Tone Preview
`voiceStylePreview.ts` exists — show a 2-sentence sample of the chosen voice/style before generation so users can adjust before spending credits.

---

## Theme 4 — Landing Page & Growth

### 4.1 Public Landing Page (`/`)
Currently `/` jumps straight into the wizard. Build a marketing landing for unauthenticated visitors:
- Hero (animated gradient, value prop, CTA)
- Live demo (interactive sample brief → generated post)
- Feature grid (multi-platform, scheduling, templates, insights)
- Social proof / testimonials placeholder
- Pricing teaser (free tier + future paid)
- Footer with privacy/terms

Authenticated users skip the landing and go straight to the wizard.

### 4.2 SEO Foundations
- Per-route meta titles/descriptions
- JSON-LD `SoftwareApplication` on landing
- OG image, sitemap.xml, canonical tags

### 4.3 Analytics
- Privacy-friendly event tracking (PostHog or Plausible)
- Track: signup, wizard-complete, generate, schedule, publish

---

## Theme 5 — Reliability & Performance

### 5.1 React Query Adoption
Replace ad-hoc `supabase` calls in pages with `useQuery`/`useMutation` for caching, retries, and dedup.

### 5.2 Pagination & Virtualization
- Paginate `MyCalendars` and `Schedule` (already have `VirtualizedList`)
- DB indexes on `scheduled_posts(user_id, scheduled_at)` and `saved_calendars(user_id, created_at)`

### 5.3 Error Boundary Telemetry
`ErrorBoundary.tsx` exists — wire it to `logger.ts` so client errors are captured (Sentry-style).

### 5.4 Edge Function Resilience
Add retry-with-backoff in the generation client; surface `failure_reason` in the UI.

---

## Theme 6 — Future / Phase 2 (deferred)

- AI-generated images per post (Gemini image preview)
- Real publishing connectors (LinkedIn, X, Meta APIs) replacing mock flow
- Team workspaces & shared templates
- Calendar version history / diff view
- Stripe-based paid tiers

---

## Suggested Execution Order

```text
Sprint 1 (highest ROI, ~2 days)
  ├─ 1.2 Draft auto-recovery     (wire existing component)
  ├─ 1.3 Schedule row actions    (UI on existing schema)
  └─ 2.1 Avatar upload           (validates storage policy)

Sprint 2 (~3 days)
  ├─ 1.1 Brief templates         (table + UI)
  ├─ 2.2 Default preferences UI  (expose existing columns)
  └─ 3.4 Tone preview            (use existing util)

Sprint 3 (~3 days)
  ├─ 4.1 Landing page            (marketing surface)
  ├─ 4.2 SEO foundations
  └─ 3.1 Post insights panel

Sprint 4 (~3 days)
  ├─ 5.1 React Query adoption
  ├─ 5.2 Pagination + indexes
  └─ 5.3 Error telemetry
```

---

## Frontend Design Upgrade Plan

This track is for the next pass over the public-facing UI using a stronger visual direction rather than incremental polish.

### Phase A — Establish a visual language
- Pick a primary aesthetic direction for the app shell, wizard, calendar, and landing page.
- Define a reusable palette, type scale, and spacing system that feels intentional rather than default.
- Decide where the product should feel editorial, where it should feel utilitarian, and where it should feel premium.

### Phase B — Reshape the highest-traffic screens
- Rework the landing page to have a stronger hero, clearer value prop, and a more distinctive composition.
- Upgrade the wizard to feel like a guided creation experience instead of a plain form.
- Refine the schedule and calendar views so hierarchy, status, and actions read faster at a glance.

### Phase C — Add polish with restraint
- Introduce page-load motion, reveal states, and richer empty/loading states.
- Use background texture, layered gradients, or ambient shapes only when they support the chosen theme.
- Keep accessibility, contrast, and responsiveness intact while making the interface feel more crafted.

### Phase D — Validate the direction
- Review the updated UI on desktop and mobile.
- Check whether the product now feels more memorable without becoming noisy.
- Keep the design system consistent across new screens and future enhancements.

### Definition of done
- The app has a clear visual identity.
- The landing page and core workflow feel like one cohesive product.
- No screen looks like a generic placeholder or stock dashboard.

---

## App-Wide UI/UX Roadmap

This is the page-by-page plan for making the entire app feel like one cohesive product. It focuses on hierarchy, navigation, state handling, and visual consistency across public and protected surfaces.

### 1. Public entry flows
- [Landing](../src/pages/Landing.tsx) should stay the strongest brand surface, but compress repeated persuasion and add one clear path into the product preview.
- [Auth](../src/pages/Auth.tsx) should separate sign-in, sign-up, and recovery more cleanly, with better trust copy and clearer feedback states.
- [ResetPassword](../src/pages/ResetPassword.tsx) should expose verifying, ready, and expired states more explicitly, with a stronger return path to sign-in.
- [NotFound](../src/pages/NotFound.tsx) should become a branded recovery page with direct links back to the landing page and app entry.

### 2. Core creation workflow
- [Index](../src/pages/Index.tsx) should become a guided creation workspace with a visible step model, persistent save status, and less visual noise in advanced controls.
 - [Index](../src/pages/Index.tsx) should become a guided creation workspace with a visible step model, persistent save status, and less visual noise in advanced controls. (Updated — guided workspace and summary hero implemented)
- Add clearer section headers, a stronger primary action, and more deliberate grouping for brief, tone, platform, and scheduling inputs.
- Improve empty, loading, and generation-in-progress states so first-time users understand what the system is doing.

### 3. Calendar review and scheduling
- [CalendarDetail](../src/pages/CalendarDetail.tsx) should read like a review workspace, not a dense control panel.
 - [CalendarDetail](../src/pages/CalendarDetail.tsx) should read like a review workspace, not a dense control panel. (Updated — review hero and active-day summary implemented)
- Prioritize the active day, summary stats, and current workflow mode, then collapse secondary actions into grouped menus.
- [Schedule](../src/pages/Schedule.tsx) should feel like a control center with a top summary, clearer time/status hierarchy, and better next-step cues.

### 4. Library and settings
- [MyCalendars](../src/pages/MyCalendars.tsx) should elevate search, sort, and filters into a real toolbar and make empty/loading states more helpful.
- [Profile](../src/pages/Profile.tsx) should be reorganized into named settings sections so users can see which defaults affect generation, publishing, and templates.
- Add a compact summary box at the top of Profile showing what will change on the next generated calendar.

### 5. Admin and support surfaces
- [Admin](../src/pages/Admin.tsx) should be brought into the same visual language as the rest of the app so it does not feel like a separate product.
 - [Admin](../src/pages/Admin.tsx) should be brought into the same visual language as the rest of the app so it does not feel like a separate product. (Updated — admin shell aligned to product visual language)
- Add more narrative around metrics, make last-updated state harder to miss, and keep dashboard layouts readable on smaller screens.
- Unify focus states, button styles, card surfaces, and spacing tokens across the app shell, public pages, and admin.

### 6. Shared UX standards to apply everywhere
- Standardize page chrome: title, subtitle, primary action, secondary action, content area, and state area.
- Standardize loading and empty states so each page has the same visual grammar for waiting, failure, and no-data conditions.
- Standardize responsive behavior so dense pages stack cleanly on mobile instead of compressing controls into unreadable rows.
- Standardize accessibility affordances: keyboard focus, 44px touch targets, accessible labels, and predictable tab order.

### 7. Recommended execution order
1. Fix the public flows first: Landing, Auth, ResetPassword, and NotFound.
2. Reshape the core workflow next: Index, CalendarDetail, and Schedule.
3. Polish library/settings pages: MyCalendars and Profile.
4. Finish with Admin and the shared design-system pass.

### Definition of done
- Every page feels like it belongs to the same product family.
- The app communicates state and next actions clearly.
- Public, workflow, settings, and admin screens all share the same visual and interaction language.

---

## Technical notes

- New tables needed: `brief_templates` (id, user_id, name, description, payload jsonb, timestamps) with owner-only RLS.
- New indexes: `scheduled_posts(user_id, scheduled_at DESC)`, `saved_calendars(user_id, created_at DESC)`.
- No edge function changes required for Sprint 1–2.
- Landing page should be a separate route component; the current `Index.tsx` (wizard) moves to `/app` or stays at `/` for authenticated users via a route guard.

---

## Open questions

1. **Landing page scope** — full marketing site (hero + demo + pricing + testimonials) or a minimal hero + CTA for now?
2. **Sprint 1 confirmation** — start with Draft recovery + Schedule actions + Avatar upload, or pick a different trio?
3. **Brief templates sharing** — per-user only, or add an `is_shared` flag for workspace-wide templates?

---

## Social Content Prompt Enhancement Plan

Goal: make generated social media copy feel more engaging, specific, and platform-native instead of generic or repetitive.

### 1. Define what “engaging” means
- Strong hook in the first line
- Clear audience fit and point of view
- One main idea per post
- More concrete language, fewer vague claims
- Clear CTA that matches the post goal

### 2. Rewrite the prompt structure
Use a fixed prompt order so the model always gets the same inputs:
- Brand voice and tone
- Target audience
- Platform and format
- Content goal
- Key message or offer
- Hook style
- CTA style
- Forbidden phrases, hashtags, and length limits

### 3. Add platform-specific variants
- LinkedIn: thoughtful, credible, insight-led
- Instagram: punchy, visual, story-driven
- X: concise, sharp, opinionated
- Facebook: warm, conversational, community-first

### 4. Add stronger constraints
- Keep the message focused on one clear idea
- Make the first line a hook, not a summary
- Use vivid, specific language over generic claims
- Avoid overused marketing phrases and filler words
- Match length to platform expectations
- Only use hashtags when they add value

### 5. Add engagement rules
- Start with a pattern-breaker hook
- Include one relatable pain point or benefit
- Prefer examples, numbers, or short stories
- Avoid generic filler like “unlock your potential”
- End with a question, invitation, or simple next step

### 6. Build a reusable prompt template
```text
You are a social media copywriter.

Write a post for [platform] about [topic] that feels human, specific, and engaging.

Audience: [audience]
Goal: [educate / convert / inspire / announce]
Tone: [voice]
Key message: [message]
Hook style: [curious / bold / story / contrarian]
CTA: [question / comment / click / save]
[Format: [single post / carousel caption / thread / short-form ad]]

Rules:
- Open with a strong hook in the first line.
- Keep the copy natural, specific, and easy to skim.
- Use one main idea only.
- Make the post feel native to the platform.
- Avoid generic marketing phrases, buzzwords, and fluff.
- If hashtags are useful, include only 3-5 relevant ones.
- Keep the CTA aligned with the goal and audience intent.
- Do not repeat the same phrasing across hook, body, and CTA.

Return:
- 3 hook options
- 1 final post
- 2 CTA variants
```

### 7. Test against sample inputs
- Try the prompt with different industries and audiences
- Compare output for clarity, energy, and uniqueness
- Check whether the post feels human and platform-native
- Keep the best-performing prompt version as default

### 8. Refine with feedback
- Capture user edits after regeneration
- Learn which hooks and CTAs perform best
- Tighten constraints where outputs drift too generic
- Add examples for best-performing formats

### Example prompt presets

**LinkedIn thought leadership**
- Goal: educate
- Tone: credible, insightful, sharp
- Hook style: contrarian or data-driven
- CTA: invite discussion

**Instagram brand post**
- Goal: inspire or announce
- Tone: vivid, warm, polished
- Hook style: story or curiosity
- CTA: save, share, or comment

**X post**
- Goal: spark conversation
- Tone: concise, direct, opinionated
- Hook style: bold or contrarian
- CTA: reply or repost

### Definition of done
- Generated posts feel more original and engaging
- The first line consistently earns attention
- Output is better matched to platform and audience
- Users need fewer manual edits after generation
- The prompt can be reused across post types without losing quality

### Definition of done
- Generated posts feel more original and engaging
- The first line consistently earns attention
- Output is better matched to platform and audience
- Users need fewer manual edits after generation
