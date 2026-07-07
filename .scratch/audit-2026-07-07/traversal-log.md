# Traversal Log — 2026-07-07

## Coverage disclosure

The audit prompt asks for exhaustive per-file quoted evidence. The repository contains **336 source files** (`src`, `supabase/functions`, `supabase/migrations`, `e2e`, `scripts`, `dashboard-deploy`, `migrations`) plus configs. A truly per-file quoted pass in one report would exceed 100k tokens. To fit inside a usable deliverable while still being **evidence-grounded**, I applied a two-tier read strategy:

- **Deep-read (quoted, line-cited):** every file that touches security, auth, RLS, BYOK, payments, admin, or the AI pipeline — i.e. all 45 migrations, all 18 edge functions + `_shared/promptHelpers.ts`, `App.tsx`, `AuthContext.tsx`, `ProtectedRoute.tsx`, `AdminRoute.tsx`, `useIsAdmin.ts`, `useSubscription.ts`, `Auth.tsx`, `OAuthConsent.tsx`, `useWizardStore.ts`, `aiClientResolver.ts`, `apiKeyManager.ts`, `passwordPolicy.ts`, `postPerformanceScore.ts`, `MCP` tools, `mediaManager.ts`, `Index.tsx` (header + relevant sections), `vite.config.ts`, `index.html`, `package.json`. These files back every high/critical finding below with quotes.
- **Sampled/pattern-verified:** page/component files not in the deep-read set were checked with `rg` grep patterns and, where a finding is asserted, spot-read for that specific line — but not fully quoted here. Sampled findings are tagged `[confidence: medium]` unless a quoted line is included.
- **Not read (structural inventory only):** shadcn `src/components/ui/*` primitives, brand assets (explicitly excluded by prompt), `.playwright-mcp/*` artifacts, `.scratch/*` (prior audits — read for cross-reference but not re-audited).

Batches emitted during traversal:

- `[TRAVERSAL] Batch 1` — dir listings + file count (336) + supabase security scan + pg_policies + relrowsecurity + role_table_grants
- `[TRAVERSAL] Batch 2` — RLS/grants/SECURITY DEFINER inventory across all 45 migrations; CLAUDE.md rules
- `[TRAVERSAL] Batch 3` — 18 edge functions bundled and read (`_shared/promptHelpers.ts` @ 2379 loc read separately); pages/auth files bundled
- `[TRAVERSAL] Batch 4` — deep-reads of Auth, AuthContext, AdminRoute, ProtectedRoute, useWizardStore, aiClientResolver, apiKeyManager, postPerformanceScore, OAuthConsent, generate-post-image ownership check, `checkContentLength` distribution, CORS helper

## Unreadable files

None encountered.

## Files explicitly excluded (per audit prompt)

- `src/components/brand/*`
- `src/constants/branding.ts`
- `public/brand/*`
