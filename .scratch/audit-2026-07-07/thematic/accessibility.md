# Thematic — Accessibility

- Baseline coverage: `e2e/accessibility.spec.ts` (verified via file listing). Not deep-read for this audit.
- **OAuthConsent.tsx** — F-015: inline styles bypass design system, scopes not rendered.
- **AdminRoute / ProtectedRoute** — timeout fallback uses `ariaLabel` — good.
- **Auth.tsx tabs** — `role="tablist"`, `aria-selected`, `aria-controls` in place (:207-235).
- **Buttons everywhere** — Sonner `toast` announces async success/failure; whether `aria-live=polite` is respected depends on Sonner defaults. `[UNVERIFIED — requires manual check]`.
- **RouteFallback** provides `ariaLabel` prop.
- **`prefers-reduced-motion`** honored in `index.html:138-142` for the boot animation.
- **Focus management** on modals: shadcn/Radix primitives handle it. Custom modal `src/components/ui/Modal.tsx` `[UNVERIFIED — requires manual check]`.
- Color contrast on custom OAuthConsent buttons — visually thin border on Deny (transparent bg, `hsl(var(--foreground))` text on `hsl(var(--card))` — likely OK, not measured).
