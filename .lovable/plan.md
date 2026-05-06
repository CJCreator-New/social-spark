# Database audit + next-wave plan

## Part A — Database issues to resolve (5 linter warnings)

The linter currently reports 5 `WARN`s. None are critical, but all should be cleaned up.

### A1. Public `avatars` bucket allows listing
- The `avatars` bucket is `public = true` and has a broad `SELECT` policy on `storage.objects`, so any visitor can list every avatar.
- Fix: keep public read of individual files, but scope the `SELECT` policy to either the file's owner folder or to objects whose path matches `auth.uid()`. List access (`storage.objects` with no name filter) gets denied.
- Also add tight `INSERT/UPDATE/DELETE` policies restricted to `auth.uid()::text = (storage.foldername(name))[1]` if not already present.

### A2–A5. `SECURITY DEFINER` functions exposed to PostgREST
Three `SECURITY DEFINER` functions exist:
- `public.has_role(uuid, app_role)` — intentionally callable from RLS policies.
- `public.handle_new_user()` — trigger only, must not be callable from API.
- `public.update_updated_at_column()` — trigger only, must not be callable from API.

Fix:
- `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on `handle_new_user` and `update_updated_at_column`.
- For `has_role`: keep `EXECUTE` for `authenticated` (RLS calls it), but revoke from `anon`. This silences the anon warning while preserving behavior.

### A6. Auth trigger sanity check
Network logs show a user signed up with email `…@outlook.con` (typo) and a profile row was created. Confirms `handle_new_user` trigger works. No fix needed, but worth recommending email-confirmation enforcement in a follow-up.

### A7. Empty calendar list for the test user
`saved_calendars` returns `[]` for the signed-in user. RLS is correct; user simply has no calendars yet. Not a bug.

---

## Part B — App-side gaps surfaced by the audit

| # | Area | Gap | Proposed fix |
|---|------|-----|---------|
| B1 | Profile | Avatar upload UI exists conceptually but no storage upload wiring | Add file input → `supabase.storage.from('avatars').upload(\`${user.id}/avatar.png\`)` → save returned public URL to `profiles.avatar_url` |
| B2 | Profiles | `display_name` is sometimes blank-overwritten on save | Guard PATCH so empty strings don't replace existing values |
| B3 | Scheduled posts | No UI to cancel / reschedule once "approved" | Add row-level actions in `Schedule.tsx` (cancel, reschedule, mark published) using existing `workflow_status` enum |
| B4 | Drafts | `DraftRecoveryDialog` exists but isn't mounted on `Index.tsx` | Wire it in so unsaved generations recover after reload |
| B5 | Calendar templates | Removed in earlier cleanup, but users want to save successful briefs as reusable presets | New table + dedicated UI (see C2) |
| B6 | Admin page | Loads even for non-admins (just shows zeros) | Gate `/admin` route with `has_role(uid, 'admin')` check; redirect non-admins to `/` |

---

## Part C — New features to ship

### C1. Avatar upload (small, high-impact)
- Add file picker on `Profile.tsx`.
- Upload to existing `avatars` bucket under `${user.id}/avatar.{ext}` (overwrite).
- After upload, call `supabase.storage.from('avatars').getPublicUrl(...)` and PATCH `profiles.avatar_url`.
- Show preview, 2 MB size limit, accept `image/png`/`image/jpeg`/`image/webp`.

### C2. Brief templates ("Save this brief")
New table `public.brief_templates`:
- `id`, `user_id`, `name`, `description`, `payload jsonb`, `created_at`, `updated_at`
- RLS: owner-only CRUD (mirror `saved_calendars`).

UI:
- "Save as template" button in the wizard's step-2 review.
- "Load template" dropdown in step-1 that pre-fills the form via existing `setForm`.
- Templates list inside `Profile.tsx` for rename/delete.

### C3. Scheduled-post management actions
Inside `Schedule.tsx` row menu add:
- **Cancel** → `UPDATE scheduled_posts SET status='cancelled' WHERE id=…` (existing column).
- **Reschedule** → opens existing date/time popover, PATCHes `scheduled_at`.
- **Mark published** → sets `workflow_status='published'`, `published_at = now()`.
All gated by RLS (already user-scoped).

### C4. Admin role enforcement + admin promotion flow
- New `useIsAdmin()` hook calling `has_role(user.id, 'admin')`.
- `/admin` route uses it; non-admins → redirect to `/`.
- Add a one-shot SQL snippet (delivered as a migration) for the project owner to seed themselves into `user_roles` as `admin`.

### C5. Draft autosave recovery
- Wire `DraftRecoveryDialog` into `Index.tsx` mount effect:
  - On mount, check `localStorage` for `draft:wizard:<userId>`.
  - If present and < 24 h old, open dialog offering "Restore" / "Discard".
- Persist on every meaningful form change (debounced 1 s).

---

## Part D — Suggested execution order

1. **DB hardening migration** (A1 + A2–A5 in one file). No code changes needed; ship first.
2. **Admin gating** (C4) — small, removes a real risk.
3. **Avatar upload** (C1) — quick win, validates storage policy from step 1.
4. **Brief templates** (C2) — biggest user value; ~1 migration + 2 UI surfaces.
5. **Scheduled-post actions** (C3) — pure UI on existing schema.
6. **Draft recovery wiring** (C5) — final polish.

Each step is a separate commit with build verification. After step 1 I'll re-run the linter and confirm 0 warnings before moving on.

---

## Open questions before I start

1. For brief templates (C2), should they be **per-user only** or also **shareable across the workspace** (would need `is_shared` + a separate read policy)?
2. For admin promotion (C4), do you want a **UI to promote other users**, or is a **one-time SQL snippet** for yourself enough for now?
3. For avatar upload (C1), OK to **overwrite** the previous avatar (single file per user) rather than versioning?
