# Workflow Audit — 2026-07-07

Every user-facing workflow present in the code. **Happy / Failure / Recovery / Edges / Missing validations / UX gaps** with file citations. Findings cross-reference `findings-register.md` by ID (e.g. F-004).

---

## 1. Email + password sign-up
Files: `src/pages/Auth.tsx:44-90`, `src/contexts/AuthContext.tsx`, trigger `handle_new_user` in `supabase/migrations/20260419114153_….sql:71-82`.

- **Happy:** signup → email confirmation → sign in → `handle_new_user` trigger creates `profiles` row + `user_roles` (role='user') → `AuthContext` picks up session → nav to `/app`.
- **Failure:** signup returns `data.session=null` → tab switches to signin, note shown (`:60-64`). Password shorter than 8 rejected client-side (`:45-47`).
- **Recovery:** "email not confirmed" mapped to friendly copy (`:82-84`).
- **Edge cases:** already-registered email → mapped to friendly copy (`:75-79`). No throttling of failed signups beyond Supabase defaults.
- **Missing:** F-006 (password policy). No "resend confirmation" button — user stuck if the email is lost.
- **UX gap:** the mode-switch after signup silently blanks the password field; no toast confirming "email sent."

## 2. Email + password sign-in
Files: `src/pages/Auth.tsx:68-72, 80-81`.

- **Happy → Failure → Recovery** all sane; error mapping (`:80-81`) covers "Invalid login."
- **Missing validation:** email is not `type="email"` verified (spot-check needed). No rate limit visible on the client — relies on Supabase's built-in.

## 3. Google OAuth
Files: `src/pages/Auth.tsx:92-105`, `@lovable.dev/cloud-auth-js`.

- **Happy:** click Google → provider consent → redirect back to `redirect_uri`.
- **Failure:** F-009 — `redirect_uri` includes `nextPath`, will exact-match-fail at Google for the MCP consent flow.
- **Recovery:** error is shown inline (`:99`).
- **Missing:** the `useAuth().user` change effect (`:37-39`) will redirect after login regardless of OAuth error; there is no explicit "cancel" handling.

## 4. Password reset request
Files: `src/pages/Auth.tsx:107-118`.

- **Happy:** email sent → `redirectTo=/reset-password`.
- **Failure:** shows raw Supabase error (`:116`) — could leak "user not found" style messages if Supabase changes phrasing.
- **UX gap:** no throttling indicator; a user can spam-click Send.

## 5. Password reset consume
Files: `src/pages/ResetPassword.tsx` (not fully quoted; visible via file listing).

- Handled by `AuthContext.onAuthStateChange` `PASSWORD_RECOVERY` event (`:68-70`) redirecting to `/reset-password`.
- `[UNVERIFIED — requires manual check]` for the actual form logic in `ResetPassword.tsx`.

## 6. OAuth 2.1 consent (MCP)
Files: `src/pages/OAuthConsent.tsx:27-196`, `src/App.tsx:117-123`, `supabase/functions/mcp/index.ts` (auto-generated).

- **Happy:** MCP client hits Supabase OAuth server → server 302s to `/.lovable/oauth/consent?authorization_id=…` → page reads session → fetches `getAuthorizationDetails` → user Approves/Denies → `window.location.href = data.redirect_url`.
- **Failure:** if not signed in, redirect to `/auth?next=<current URL>` (`:39-43`) — this triggers F-009.
- **Recovery:** errors surface inline via `role="alert"` (`:110-124`).
- **Missing validation:** F-014 (no allowlist on target redirect); F-015 (no scope list rendered).
- **Edge:** `authorizationId` blank → `setError("Missing authorization_id")`; `active` guard cancels stale requests.

## 7. Wizard: brief → generate calendar
Files: `src/pages/Index.tsx` (:1-59 read), `src/stores/useWizardStore.ts`, `supabase/functions/generate-calendar/index.ts`, `wizard_drafts` table.

- **Happy:** wizard steps 1-5 collected in Zustand → `useCreateCalendarMutation` (`useCalendarQueries.ts`) → edge function → 7 posts returned → saved via `saved_calendars` insert.
- **Failure:** rate-limited → 429; quota exceeded → 402 with `QUOTA_EXCEEDED` code; AI provider down → 503 with `PLATFORM_UNAVAILABLE` and message pointing users at BYOK toggle (`generate-calendar/index.ts:180-190`).
- **Recovery:** wizard autosaves to `wizard_drafts` (per migration). Draft restore modal in `DraftRecoveryDialog.tsx`. F-010: offline autosave loses in-memory state on refresh.
- **Missing:** `checkContentLength` is applied (only endpoint that does — good). No cross-tab lock; two tabs editing the same draft race the autosave.

## 8. Single-post generate
Files: `supabase/functions/generate-single-post/index.ts`.

- **Happy:** normal path, quota checked, incremented.
- **Failure:** 401 if no user, 429 rate-limited, 402 quota exceeded, 503 provider down.
- **Recovery:** retries handled by `callAIGateway` (retries 2x for 5xx/timeout, not 503).

## 9. Regenerate post / batch regenerate
Files: `supabase/functions/regenerate-post/index.ts` (416 loc, deep-read pending), `src/pages/CalendarDetail.tsx:__tests__/batchRegenerate.test.tsx`.

- Test coverage exists for batch regenerate (verified via file listing).
- `[UNVERIFIED — requires manual check]` for whether regenerate-post applies quota consistently. Grep confirms it does import `checkQuota`.

## 10. Inline rewrite
Files: `supabase/functions/inline-rewrite/index.ts:23-90`.

- **Happy:** small selection + instruction → rewritten text returned.
- **Failure:** rate-limit only. F-002 (no quota), F-003 (no content-length cap).
- **Missing:** no bound on `body.text` size.

## 11. Repurpose post to another platform
Files: `supabase/functions/repurpose-post/index.ts:19-195`.

- Same class of gaps as inline-rewrite (F-002, F-003).
- Positive: variant scoring path exercised here (`:171-184`).

## 12. Generate post image
Files: `supabase/functions/generate-post-image/index.ts:139-260`, storage bucket `post_images` (migration `20260602143000_post_images_bucket.sql`).

- **Happy:** UUID + day + prompt → gateway image gen → 45s timeout → base64 → upload to storage → `media_references` upsert → return URL.
- **Failure:** F-004 (no ownership check on `calendarId`), F-002 (no quota — expensive!), F-011 (raw upstream body logged).
- **Recovery:** 504 on timeout (:229-231), 500 on invalid JSON (:252).

## 13. Schedule posts & queue publish
Files: `src/pages/Schedule.tsx`, `supabase/functions/queue-worker/index.ts:132-158`.

- **Happy:** user schedules → row in `scheduled_posts` → cron invokes `queue-worker?mode=process` → `claim_next_job` RPC → `publish_scheduled_post` job type marks row published.
- **Failure:** attempts with exponential backoff (500ms → 60s cap), `failed` at max_attempts (default 5) (`:112-128`).
- **Recovery:** re-run of cron picks up next `pending`.
- **Missing:** F-001 makes this dangerous — a hijacked `scheduled_posts` row will be published by the worker under the victim's account context (worker publishes regardless of ownership).
- **Auth:** `verifyCronSecret` on entry (`:134`). OK.

## 14. Media cleanup
Files: `supabase/functions/cleanup-media/index.ts:20-60`.

- **Happy:** orphan candidates older than 24h → deleted from storage & row soft-deleted.
- **Failure:** `hasDbReferences` returns true on any fetch error → keeps file (safe-side).
- **Missing:** doesn't check `saved_calendars.form_payload` JSONB for embedded URLs (only profiles + media_references count). A media URL referenced only inside a calendar post can be reaped.

## 15. Save API key (BYOK)
Files: `src/lib/apiKeyManager.ts:57-104`, `supabase/functions/encrypt-api-key/index.ts:16-260`, RPC `upsert_encrypted_api_key`.

- **Happy:** client validates format → sends to edge fn → optional `validate` action pings provider → save action calls `upsert_encrypted_api_key` (pgsodium AEAD).
- **Failure:** format invalid → client throws INVALID_KEY_FORMAT; provider ping fails → reason mapped (:112-124).
- **Recovery:** delete via `delete-api-key/index.ts`.
- **Positive:** never returns plaintext after storage; `get_decrypted_api_key` only accessible to authenticated & only returns caller's own key.

## 16. Admin: view stats
Files: `src/pages/Admin.tsx`, RPC `admin_calendar_stats` (`20260706000000_admin_calendar_stats_rpc.sql`), `src/hooks/useIsAdmin.ts`.

- **Happy:** `AdminRoute` gates on `useIsAdmin` (`has_role`) → dashboard fetches stats via SECURITY DEFINER RPC (bypass RLS, admin-gated internally).
- **Failure:** RPC raises `Not authorized` for non-admins.
- **Recovery:** `AdminRoute` (`AdminRoute.tsx:11-19`) has an 8s timeout with a friendly fallback.
- **Positive:** the `20260706000000` migration correctly moves stats server-side (documented root cause: RLS was silently returning admin's own calendars only).

## 17. Admin: grant tier
Files: `supabase/migrations/20260617000000_admin_comp_grants.sql:25-85`.

- **Happy:** admin calls `admin_grant_tier(target, tier, quota, days)` → RPC verifies `is_admin()` → inserts comp payment row + updates `user_settings`.
- **Failure:** non-admin → `RAISE EXCEPTION 'Not authorized'`.

## 18. Payment: checkout
Files: `src/lib/razorpayCheckout.ts`, `supabase/functions/create-order/index.ts`, `supabase/functions/verify-payment/index.ts`, `RazorpayCheckoutButton.tsx`.

- **Happy:** client picks plan → `create-order` returns Razorpay order → widget → verify-payment.
- **Failure/Recovery:** F-020 (no automated test); positive: verify-payment is well-implemented (F-026).

## 19. Sign out
Files: `src/contexts/AuthContext.tsx:102-110`.

- **Happy:** `supabase.auth.signOut()` → `onAuthStateChange` clears user.
- **Missing:** no explicit revocation of any locally-cached MCP tokens; not applicable to this codebase yet.

## 20. Session expiry / multi-tab
- `AuthContext.onAuthStateChange` reacts to token refresh & signout in both tabs (Supabase default).
- Wizard autosave doesn't lock across tabs (F-010 note).

## 21. Password recovery flow
Covered under 4 + 5.

## 22. Draft recovery
Files: `src/components/DraftRecoveryDialog.tsx`, `wizard_drafts`.

- Restore from DB — but F-010: offline-only unsaved state is lost.

## 23. Undo / redo (editor)
Files: `src/hooks/useUndoRedo.ts`, exercised by wizard.

- `[UNVERIFIED — requires manual check]` for depth cap / memory limit.

## 24. Export calendar
Files: `src/lib/exportCalendar.ts`, `exportSchedule.ts`.

- Tests exist (`__tests__/exportCalendar.test.ts`). Downloads ICS + CSV.

## 25. 404 / not found
Files: `src/pages/NotFound.tsx` (30 lines read via `/tmp/pages.txt` header).

- Simple 404 page. No search suggestion or "recently viewed."

## 26. Offline generation fallback
File: `src/lib/localPostGenerator.ts`, test `src/pages/__tests__/Index.offlineGeneration.test.tsx`.

- Exists as a local heuristic fallback when network fails.
