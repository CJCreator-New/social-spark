# UI/UX Audit — 2026-07-02 (continued pass)

**Method note:** This continues the earlier same-day pass in this file (see git history). That pass was static/code-only and explicitly deferred: `src/styles/tokens.css`, the per-component sweep, and a live browser pass. This pass closes most of those gaps directly (no subagent delegation, per the prior session's note that specialized subagents hallucinated tool output). **A live Playwright visual pass was still not performed this session** — everything below is evidence from source, not from rendered screenshots. That remains the single biggest open gap; see Follow-up §1.

---

## Design tokens — revised findings

The original pass verified `src/index.css` (the HSL semantic-token layer) is clean. This pass went one level deeper: `src/index.css` imports `src/styles/tokens.css`, a **second, parallel hex-based token system** consumed by `pages.css`/`contentforge.css`/`Index.css`. That system is *not* a dark-theme leftover — its values (`#c2410c`, `#faf8f4`, etc.) correctly match the warm-editorial palette. But three real problems sit underneath it:

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | `pages.css` hardcodes the palette as literal hex **627 times** and `contentforge.css` **139 times**, instead of referencing `var(--color-*)` from `tokens.css` (only 151 `var(--` uses in `pages.css` vs. 627 hex literals). Values are currently correct, but any future palette change requires editing hundreds of literal occurrences across 3 files instead of the token source. | Major | `src/styles/pages.css` (grep count: 627 hex, 151 `var(--`), `src/styles/contentforge.css` (139 hex) |
| 2 | `src/pages/Index.css` (the wizard/post-editor surface, `.cf-app`) contains **actual off-palette dark-theme leftovers**, not just duplication. `.cf-app` itself is defined with a light cream base (`--bg: #faf8f4`), but nested rules layer `rgba(255,255,255,0.01–0.06)` as background/border tints **18 times** — a technique that only makes sense to lighten a *dark* base; on a cream background it renders as near-invisible or muddy. | Major | `src/pages/Index.css:33,34,39,42,48,137,179,216,291,381,507,528,555,591,720,790,823,835` |
| 3 | Same file uses two off-palette hardcoded colors not defined anywhere in either token system: `#686880` (cool blue-gray) for `.body-text`, and `#f0d49a` (amber/gold) for `.budget.warn` / `.cf-nav-status.saving` — duplicating what `--color-warning` (`#f59e0b`) already covers, with a different hue. | Minor–Major | `src/pages/Index.css:190` (`#686880`), `:292,512` (`#f0d49a`) |

**Component-level duplication of the same anti-pattern**, found via direct component grep (not covered in the original pass at all):

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 4 | `HashtagChipEditor.tsx` hardcodes per-platform badge colors inline, including hues with **no relationship to the warm-editorial palette at all** (`#9ab5f0` blue, `#9aecf0` cyan, `#9a9af0` purple for Instagram/Twitter/Facebook badges) alongside `#f59e0b` reused three times instead of a shared constant. | Major | `src/components/HashtagChipEditor.tsx:6-12` |
| 5 | `WeekBalanceScore.tsx` hardcodes score-tier colors (`#a3d977` good, `#f0d49a` fair, `#f09a9a` needs-work) as inline JS literals, **despite `--score-high`/`--score-med`/`--score-low` already existing as semantic HSL tokens in `src/index.css:90-92`** for exactly this purpose. The values don't even match — token `--score-low` is `0 74% 42%` (a proper red), component uses `#f09a9a` (a pale pink). | Major | `src/components/WeekBalanceScore.tsx:97-99` vs. `src/index.css:90-92` |
| 6 | `PostInsights.tsx` — a component rendered on effectively every generated post — is built almost entirely with inline `style={{ color: "#78716c", ... }}` hex literals (30+ occurrences), bypassing Tailwind/token classes completely. High blast radius: any future palette or dark-mode work will miss this component silently since it has zero `hsl(var(--…))` or Tailwind color-class references. | Major | `src/components/PostInsights.tsx:31-118` (extensive; representative lines 43-45, 66-70, 84-97) |

**Passing checks confirmed this pass:**
- Zero `bg-black`/`text-white` matches anywhere in `src/**/*.tsx` (whole-tree grep) — the old dark-theme class sweep is genuinely clean at the component level.
- Radix overlays (`dialog.tsx:22`, `sheet.tsx:22`) correctly use the semantic `bg-overlay/55` token, not `bg-black/80`. Did not re-check `alert-dialog.tsx`/`drawer.tsx` individually this pass — recommend a quick follow-up grep.
- No `py-32`+ (or larger) Tailwind spacing classes found in `src/pages/*.tsx` — the "dead whitespace band" checklist item has no hits at the page-shell level (doesn't rule out dead space from CSS-defined padding in `pages.css`/`Index.css`, which wasn't measured visually).
- Markdown-leak guard exists and is exercised: `platformCopy.ts` plus 5 consumers (`Index.tsx`, `CalendarDetail.tsx`, `IndexResults.tsx`, `PlatformPreview.tsx`) and a dedicated test `platformCopyStyle.test.ts`. No unguarded `dangerouslySetInnerHTML` rendering of AI output found.
- `prefers-reduced-motion` is referenced in 11 files including `pages.css`/`App.css` and all major landing sections (`LandingHero`, `BentoGrid`, `FeatureShowcase`, `Pricing`, `Testimonials`, `HowItWorks`, `SocialProofBar`, `FinalCTA`, `LandingNav`) — landing motion respects the setting. Did not verify wizard/in-app Framer Motion transitions (`Index.tsx` step transitions, modals) respect it — no hits for those files in the grep, worth a targeted follow-up.
- `FeedbackModal.tsx`, `OnboardingTour.tsx`, `WelcomeBanner.tsx`, `TierBadge.tsx`, `ProGate.tsx`, `BufferScheduler.tsx` all came back clean for hex/`bg-black`/`text-white` in a pattern-match sweep — not read in full, but no evidence of the anti-pattern found in these files.

---

## Not yet covered (unchanged from original pass, still open)

- Live Playwright visual pass at 390×844 / 1280×1800 across routes — **not performed**. Everything above is source-level evidence; actual rendered spacing, dead-space bands inside `pages.css`/`Index.css`-styled surfaces, contrast ratios, and focus-ring visibility on cream still need eyes-on verification.
- Card padding uniformity (24px desktop / 16px mobile) and grid gap consistency — requires either full reads of `pages.css`/`contentforge.css` (5,500+ combined lines) or a live pass; not attempted.
- Container width consistency (`max-w-*`) across authenticated pages — not checked this pass.
- Contrast ratio verification against the warm palette — not checked; would benefit from axe-core (`e2e/accessibility.spec.ts`) actually being run, not just reasoned about from memory.

## Recommended follow-up (priority order)

1. **Run a live Playwright pass** (`npx playwright test e2e/accessibility.spec.ts` plus a manual screenshot script) at both viewports across `/`, `/auth`, `/app`, `/my-calendars`, `/calendar/:id`, `/schedule`, `/profile`, `/admin`. This is the one methodology step from the original plan never executed across two passes now, and it's required to confirm/deny the dead-space and contrast checklist items.
2. Fix `PostInsights.tsx` and `WeekBalanceScore.tsx` to consume the existing `--score-high/med/low` and semantic surface/text tokens instead of inline hex — highest blast radius since both render on every post.
3. Replace the `rgba(255,255,255,0.0X)` dark-theme-pattern tints in `src/pages/Index.css` (wizard/post-editor surface) with light-appropriate equivalents (e.g., `color-mix` against `--color-surface`/`--color-bg`, consistent with the one correct usage already at `Index.css:33`).
4. Decide product-wise whether `pages.css`/`contentforge.css`'s literal-hex approach is acceptable long-term or should be migrated to `var(--color-*)` — 766 combined literal occurrences is a real maintenance cost but not a visible bug today.
5. Quick grep of `alert-dialog.tsx`/`drawer.tsx` for overlay scrim consistency, and of in-app (non-landing) Framer Motion usage for `prefers-reduced-motion` handling — both flagged above as unverified rather than failing.
