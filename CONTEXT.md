# Context

Domain glossary and known accepted limitations for Social Spark / ContentForge.

## Known limitations (accepted, not bugs)

### Single-tab wizard editing (state-flow-keeper, CF-32)

The wizard store (`src/stores/useWizardStore.ts`) persists to `localStorage` under
the `cf:wizard` key via Zustand's `persist` middleware. There is no
`window.addEventListener("storage", ...)` listener anywhere in the app, so if a
user has the wizard open in two browser tabs at once, each tab writes the whole
persisted blob independently and the last tab to write wins — the other tab's
in-memory state is silently clobbered on its next write.

This is an accepted single-tab-editing assumption, not a defect to fix. Building
cross-tab sync (e.g. reacting to `storage` events to merge or warn on conflict)
is disproportionate to the actual risk for this workflow. If this becomes a
recurring complaint, revisit with a scoped design rather than ad hoc patches.

## Styling systems (current state, CF-29)

The front-end presentation layer currently mixes three parallel styling approaches:

1. **Tailwind utility classes** — used in newer components (e.g. `shadcn/ui`-based primitives under `src/components/ui/`).
2. **Custom, BEM-ish hand-written CSS** — the bulk of page-level and landing styling lives in `src/styles/contentforge.css`, `src/styles/pages.css`, and `src/pages/Index.css`, which define token aliases (`--accent`, `--text2`, `--text3`, `--surface`, `--border2`, etc.) mapped onto the base warm/orange brand palette in `src/styles/tokens.css`.
3. **Inline style objects and runtime `<style>` injection** — many components (e.g. `PerformanceScoreCard.tsx`, `InspirationBank.tsx`, `HashtagChipEditor.tsx`, large parts of `Index.tsx`) set styling via inline `style={{ ... }}` props. `src/pages/CalendarDetail.tsx` additionally builds and injects a `<style>{css}</style>` block at render time for page-specific rules.

**Rule:** new or touched components should use the existing token aliases (`--accent`, `--text2`, `--text3`, `--surface`, `--border2`, etc.) and existing custom CSS classes in `contentforge.css`/`pages.css`/`Index.css` rather than introducing new inline style objects or hardcoded color literals. When a file with inline styles is already open for an unrelated change, opportunistically fold those inline styles into the existing stylesheets — but don't do a wholesale rewrite of a file just to chase this rule.
