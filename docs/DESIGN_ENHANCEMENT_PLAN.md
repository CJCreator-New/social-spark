# Whitespace Reduction Enhancement Plan

## Overview

This plan targets whitespace reduction in ContentForge while preserving readability, visual hierarchy, and core functionality. Focus areas: global layout containers, section spacing, card margins, and typography.

**Status: verified against current codebase (2026-07-08) and reviewed for design quality. All Priority sections below reflect the corrected/finalized targets — this is the version to build from.**

## Design Token Reference

### Typography (tokens.css)
- Font families: Inter (body), Lora/Fraunces (display), JetBrains Mono (mono)
- Scale: 11px/13px/15px/18px/22px/28px/32px
- Already well-defined; no changes needed

### Spacing (tokens.css)
- Existing scale: `--space-1: 4px` ... up to `--space-10: 40px` (4/8/12/16/20/24/28/32/40)
- **Rule for this pass: every new spacing value must land on this scale.** Two values in the original draft didn't (100px→64px, 26px→22px) — corrected below. Where a target must exceed 40px (e.g. bottom padding), add a named token (`--space-16: 64px`) rather than a bare px literal in CSS.

### Border Radius (tokens.css)
- `--radius-xs: 4px` | `--radius-sm: 8px` | `--radius-md: 10px` | `--radius-lg: 12px` | `--radius-xl: 14px` | `--radius-2xl: 16px`
- Index.css redefines locally as `--r-sm: 8px` | `--r-md: 12px` | `--r-lg: 16px`

### Shadows (tokens.css)
- Flat design: `--shadow-card: 0 1px 2px rgba(120, 113, 108, 0.05)`
- Subtle hover: `--shadow-card-hover: 0 2px 8px rgba(120, 113, 108, 0.08)`
- Appropriate for warm editorial style; retain

## Whitespace Reduction Targets

### Priority 0: Consolidate Duplicate Rules (do this first)

`contentforge.css` and `Index.css` each independently define `.brand`, `.stepper`, and `.card`/`.csect`. Editing values in two places in parallel is how `.stepper` already drifted (44px vs 36px). Before changing any numbers:
- Confirm which rules are truly duplicated (`.brand`, `.card`, `.csect` currently hold **identical** values in both files) vs. structurally different (`.stepper` — contentforge.css uses a flex layout, Index.css uses a bordered-grid `.snode` layout, so its rule can't just be merged, only the margin value harmonized).
- Where values are identical today, prefer expressing them once (shared CSS custom property or a shared class) so this pass doesn't need to touch two files per change and future drift is structurally prevented.

### Priority 1: Global Layout (Highest Impact)

**File: src/components/layout/WorkspacePage.tsx:24-27**
- Current: `className="... px-4 py-[52px] sm:px-6"` with `style={{ maxWidth: MAX_WIDTHS[size], paddingBottom: "100px" }}` inline
- **This is a separate, independent surface from `.cf-app .inner` below** — it wraps *every* protected route (Index, Schedule, Profile, Calendar, etc.), not just ContentForge. Must be updated as its own line item or the two will silently diverge.
- Proposed: `py-[52px]` → `py-8` (32px), inline `paddingBottom: "100px"` → `"64px"` (or move to a `--space-16: 64px` token and reference it)

**File: src/styles/contentforge.css:59-65**
- Current: `.cf-app .inner { padding: 52px 24px 100px; }`
- Proposed: `padding: 32px 24px 64px` (32px and 24px are on-scale via `--space-8`/`--space-6`; 64px needs a new `--space-16` token — see Spacing section above)
- **Mobile**: contentforge.css already has a `max-width: 640px` override at lines ~1753-1799 (`padding: 36px 16px 80px`) — this must be reduced in proportion, not left stale.
- **Index.css note**: Index.css's own `.inner` selector has no `padding` property at all (base or mobile) — verify at implementation time where the Index page's outer spacing actually comes from before assuming this rule needs a parallel edit there.

### Priority 2: Brand & Stepper

**File: src/styles/contentforge.css:71-73 + Index.css:45-47**
- Current: `.brand { margin-bottom: 52px; }` (identical in both files)
- Proposed: `margin-bottom: 40px` (`--space-10`) — **intentionally less aggressive than a flat 32px.** The masthead/brand region is the strongest editorial signal on the page; over-compressing it risks making the app read as a generic form rather than the intended warm-editorial product. Hold more of the reduction budget here than in utility sections below.

**File: src/styles/contentforge.css:123-127 + Index.css:217-222**
- Current: `.stepper { margin-bottom: 44px; }` (contentforge) / `margin-bottom: 36px;` (Index.css) — confirmed genuine divergence, not just a plan error
- Proposed: `margin-bottom: 24px` in both, applied to each file's respective (structurally different) `.stepper` rule

### Priority 3: Card & Section Spacing

**Files: contentforge.css (231-240, 246-248) + Index.css (305-314, 318-320)** — values confirmed identical in both files today
- Current: `.card { padding: 26px; margin-bottom: 14px; }`
- `.csect { margin-bottom: 26px; }`
- Proposed: `.card { padding: 24px; margin-bottom: 12px; }` (24px = `--space-6`, on-scale; original 22px target was not)
- `.csect { margin-bottom: 20px; }` (`--space-5`, on-scale)

### Priority 4: Inline Style Objects in Components

Components requiring style consolidation into CSS:
- `src/pages/Index.tsx` - Main wizard workspace
- `src/pages/Profile.tsx` - User settings — confirmed inline spacing styles at lines 615, 619, 828, 995, 996 (margins/spacer heights)
- `src/pages/Schedule.tsx` - Scheduling queue — confirmed inline spacing styles at lines 468, 472, 564, 595
- `src/pages/CalendarDetail.tsx` - a module-level `const css = \`...\`` template literal, lines 134-296 (163 lines), rendered via a static `<style>{css}</style>` tag at line 1828. **Correction from earlier draft: this is a static string, not a `useEffect`-based runtime injection** — safe to migrate line by line into a real stylesheet without worrying about dynamic/conditional CSS generation, but audit for any string interpolation before assuming it's fully static.

## Page-by-Page Summary

| Page | Route | Current Issues | Priority |
|------|-------|--------------|----------|
| Index | `/` (protected) | Hero grid, stepper, card spacing | High |
| Landing | `/` (public) | Hero padding 100px/80px — lives in `src/styles/pages.css:254-257` (`.ld-w-hero`), *not* `Landing.tsx` (that file is a thin 97-line composition shell around `LandingHero.tsx`) | Medium — see note below |
| Auth | `/auth` | Already optimized via pages.css | Low |
| Schedule | `/app/schedule` | Inline styles, 80px padding | High |
| Profile | `/app/profile` | Card padding, section margins | Medium |
| Calendar | `/app/calendar` | Static injected `<style>` block, spacing inconsistencies | High |
| MyCalendars | `/app/calendars` | Card list spacing | Low |
| Repurpose | `/app/repurpose` | Standard card patterns | Low |

**Landing hero note**: marketing/first-impression surfaces conventionally warrant more generous whitespace than in-app utility screens. Recommend either excluding `.ld-w-hero` from this pass entirely, or applying a lighter reduction (e.g. 100px/80px → 80px/64px, both on-scale) rather than matching the in-app compression ratio.

## Implementation Sequence

1. **Phase 0**: Consolidate duplicate `.brand`/`.card`/`.csect` rules between `contentforge.css` and `Index.css`; harmonize the diverging `.stepper` margin value (see Priority 0)
2. **Phase 1**: Global container reduction — both `WorkspacePage.tsx`'s inline styles *and* `.cf-app .inner` (including its mobile breakpoint), treated as two separate edits
3. **Phase 2**: Brand/header spacing harmonization
4. **Phase 3**: Card/section spacing standardization
5. **Phase 4**: Component inline style consolidation (Profile.tsx, Schedule.tsx, CalendarDetail.tsx — as opportunistic work)

## Risks & Mitigations

- **Risk**: Reducing padding may cause visual density issues on mobile
  - **Mitigation**: Verify responsive breakpoints; contentforge.css's existing 640px override for `.inner` must be updated in proportion, not left stale
- **Risk**: `WorkspacePage.tsx`'s inline `paddingBottom: "100px"` is edited independently from `contentforge.css`, causing the two to drift again
  - **Mitigation**: Treat as one Phase 1 change set; ideally source both from the same `--space-16` token
- **Risk**: Over-compressing `.brand`/masthead spacing erodes the warm-editorial character the design system is going for
  - **Mitigation**: Use the smaller 40px (not 32px) target for `.brand`; hold the line on Landing hero per note above
- **Risk**: No sticky/fixed bottom action bars currently depend on the 100px bottom padding (confirmed via search of WorkspacePage/Index/IndexResults/Schedule — only transient absolute-positioned dropdowns exist), so 64px is safe today, but re-check if a floating footer is added later before further compressing

## Success Metrics

- Reduced vertical scrolling on Index by ~15%
- Consistent spacing scale across all pages (every value traceable to a `tokens.css` spacing variable)
- No accessibility regressions (contrast, tap targets — explicit 44×44px minimum check on mobile after card/section compression)
- Inline styles reduced by 30% in touched components
- Before/after visual regression screenshots per page (Playwright screenshot diff via `e2e-test-writer`)
- Dark mode pass confirming spacing changes don't affect theme variants
- `prefers-reduced-motion` unaffected if any spacing changes interact with existing `framer-motion` layout animations