# Thematic — Technical Debt

- **F-022** — three consecutive migrations repairing the same BYOK grants.
- **`_shared/promptHelpers.ts`** — 2379 loc god-module with mixed responsibilities (auth, rate-limit, quota, AI orchestration, normalization, hashtag policy). Refactor deferred per audit rules.
- **`rejectFreeTierByok` deprecated** (`_shared/promptHelpers.ts:855-862`) — kept as no-op; caller sites remain. Mark for removal.
- **`aiClientResolver.ts:53,62`** — placeholder string `"USER_KEY_STORED_SERVERSIDE"` (F-012). Debt for future callers.
- **`dashboard-deploy/*.ts`** duplicates edge function contents. Drift risk.
- **Two overlapping admin identity systems**: `user_roles` (with `has_role`) and `admin_users` table. `is_admin()` OR-combines both (`20260617000000_admin_comp_grants.sql:12-17`). Simplification opportunity — pick one.
- **`localPostGenerator.ts`** — offline fallback AI generation. Not deep-read; likely low quality output vs real AI. Acceptable if scoped to offline UX only.
- **Two `deno.json` roots** — `supabase/functions/deno.json` empty imports map. If any function needs pinned deps, add them here rather than URL-import in each file.
