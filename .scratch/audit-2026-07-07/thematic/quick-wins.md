# Thematic — Quick Wins

Low-effort, high-value items (each maps to a finding for traceability):

1. **F-005** (30 min) — `REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated`.
2. **F-003** (~15 min per fn × 6) — Add `checkContentLength(req)` to `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image`.
3. **F-011** (~10 min) — Wrap the two `console.error` sites in `sanitizeLogValue(text)`.
4. **F-017** (~5 min) — Flip `refetchOnWindowFocus:true` in `App.tsx:41-49`; scope with per-query overrides.
5. **F-021** (~5 min) — Remove or replace the preview-URL OG image in `index.html`.
6. **F-014** (~10 min) — Add `if (!/^https?:\/\//.test(target)) return setError(...)` in `OAuthConsent.tsx:70-75`.
7. **F-019** (~10 min) — In dev mode, return 400 for unknown telemetry events.
8. **F-018** (~15 min) — Add `radix` and `tanstack` chunks in `vite.config.ts:29-42`.
9. **F-006** (~10 min + Supabase dashboard toggle) — Bump `PASSWORD_MIN_LENGTH` and enable HIBP.
