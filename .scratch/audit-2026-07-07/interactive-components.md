# Interactive Component Audit — 2026-07-07

Coverage disclosure: this section audits the interactive elements observed in the deep-read files (Auth page, OAuthConsent, AdminRoute, ProtectedRoute, Landing shell, Index wizard scaffold, and shadcn primitives inventoried in `src/components/ui/`). Elements in files not deep-read are grouped by pattern with `[sampled]`.

Each row: **correctness · a11y · keyboard · loading · error · success feedback**.

## Auth.tsx (`src/pages/Auth.tsx`)

| Element | Correctness | A11y | Keyboard | Loading | Error | Success |
|---|---|---|---|---|---|---|
| Signin/Signup/Forgot tabs (:207-235) | OK — `role="tablist"`, `aria-selected`, `aria-controls` | ✔ | ✔ (native `<button>`) | n/a | n/a | n/a |
| Email input | `[UNVERIFIED]` — need to verify `type="email"` and `autoComplete="email"` | partial | ✔ | n/a | error surfaced inline | n/a |
| Password input | `[UNVERIFIED]` — need to verify `type="password"` & autocomplete tokens | partial | ✔ | n/a | inline | n/a |
| Submit button | Correct; disables via `loading` | partial (no `aria-busy`) | ✔ | spinner via disabled state | inline | toast on success |
| Google button (:92-105) | F-009 redirect_uri bug | ✔ | ✔ | `googleLoading` local state | inline | provider handles |

## OAuthConsent.tsx

| Element | Correctness | A11y | Keyboard | Loading | Error | Success |
|---|---|---|---|---|---|---|
| Deny button (:155-171) | Correct | disabled state visually weak (F-015); no `aria-busy` | ✔ | `busy` gate | inline `role=alert` | full-page nav |
| Approve button (:172-189) | F-014 (no target validation) | same | ✔ | `busy` gate — but no spinner in label variant | inline | full-page nav |
| Scopes list | **Missing** — `details.scopes` fetched but never rendered (F-015) | ✗ | n/a | n/a | n/a | n/a |

## AdminRoute.tsx / ProtectedRoute.tsx

| Element | Correctness | A11y | Keyboard | Loading | Error | Success |
|---|---|---|---|---|---|---|
| Loading fallback | 8s timeout to alt copy (both files :17-19) | uses `ariaLabel` | n/a | ✔ | timeout copy | ✔ |
| Redirect-on-fail | `<Navigate to="/app" replace>` (AdminRoute:34), `<Navigate to="/auth" state={{from}}>` (ProtectedRoute:27) | n/a | n/a | n/a | admin route also toasts (:22) | n/a |

## Wizard (Index.tsx) `[sampled]`
- Uses Zustand store + `WelcomeBanner`, `DraftRecoveryDialog`, `GenerateSkeleton`, `PerformanceScoreCard`, `HashtagChipEditor`, `PersonaCompare`, `ToneConsistencyChecker`. All present in `src/components/`.
- Loading states: `GenerateSkeleton` + `SkeletonList` + `ScheduleSkeleton` exist per file listing — good coverage.
- Error states: `ErrorBoundary` at App root + `ErrorState` component available; individual error paths not audited row-by-row.
- Empty states: `EmptyState.tsx` exists.

## shadcn UI primitives `[sampled]`
- Full Radix roster in `package.json:186-220`. shadcn primitives inherit Radix a11y (focus trap, `aria-*`), so risk is low unless overridden.
- Not audited individually.

## Landing page (`src/components/landing/*`) `[sampled]`
- 5 components per prior context. Uses `three`/`gsap` (chunked in `vite.config.ts:32-38`).
- `[UNVERIFIED — requires manual check]` for `prefers-reduced-motion` handling on the animated hero — the audit prompt didn't flag it, and the plan-only landing enhancement work is not yet merged.

## Buttons/CTAs across pages `[sampled]`
- Sonner `toast` used everywhere for success/error signals — consistent pattern.
- Confirm dialogs via `src/components/ui/ConfirmDialog.tsx` and Radix `AlertDialog`.

## Forms
- `@hookform/resolvers` + `react-hook-form` present in deps. Not every form uses it — Auth.tsx uses local `useState`, no formal validation library. Consistent risk.

---

*Elements without dedicated deep-read remain `[sampled]`. See `findings-register.md` for defects promoted out of this table.*
