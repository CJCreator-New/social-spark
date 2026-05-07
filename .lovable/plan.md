# App Enhancement Plan

Building on the completed work (DB hardening, admin gating, single-day generation, scheduling, ICS export), here are the next high-impact enhancements grouped by theme.

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
