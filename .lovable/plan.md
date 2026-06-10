
## What's actually wrong

There are **two separate issues**, both real, neither is "the database is down". The live Lovable Cloud DB is reachable — the preview is successfully querying `saved_calendars` and `scheduled_posts` right now with your JWT. The failures come from (1) your local clone missing real env values and (2) two migrations that exist in the repo but were never applied to the live DB.

### Issue 1 — Local dev: "failed fetch" on sign in / sign up

- `.env` is in `.gitignore`, so when you cloned/pulled the repo locally, your `.env` is either missing or holds the placeholder/mock values you mentioned.
- `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. With mock values, every `supabase.auth.signInWithPassword(...)` and `signUp(...)` call resolves to "Failed to fetch" because the URL doesn't exist.
- The preview works because Lovable injects the real values automatically; your local machine doesn't.

### Issue 2 — Schema drift in the live DB (visible in network tab right now)

Two requests are failing from the live preview with very specific errors:

- `GET /rest/v1/wizard_drafts` → `PGRST205 Could not find the table 'public.wizard_drafts' in the schema cache`
- `GET /rest/v1/profiles?...brand_examples...` → `42703 column profiles.brand_examples does not exist`

The corresponding migration files exist in the repo but were never run against the live database:

- `supabase/migrations/20260508173000_create_wizard_drafts.sql`
- `supabase/migrations/20260602_add_profile_brand_examples.sql`

These break draft auto-save and brand-memory loading — they don't block sign-in, but they spam the network tab and silently disable features.

## Fix plan

### Step 1 — Restore local `.env` with the real Lovable Cloud values

Create `.env` at the project root (it stays gitignored — that's fine, just present locally):

```
VITE_SUPABASE_PROJECT_ID="mbxlvsftyifovbkpsvyw"
VITE_SUPABASE_URL="https://mbxlvsftyifovbkpsvyw.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<the anon/publishable key from Cloud → API settings>"
```

Then `npm run dev` again. Sign in / sign up will hit the real backend and the "failed fetch" goes away.

I'll write this file for you using the keys already configured in this project so you don't have to copy-paste.

### Step 2 — Apply the two missing migrations to the live DB

Re-run the existing migration SQL (idempotent — uses `IF NOT EXISTS`) so the live schema matches the repo:

- Create `public.wizard_drafts` with `user_id`, `snapshot` (jsonb), timestamps, RLS scoped to `auth.uid()`, and required GRANTs.
- Add `brand_examples`, plus any other columns in `20260602_add_profile_brand_examples.sql` that are missing, to `public.profiles`.

Each will go through the standard migration approval flow.

### Step 3 — Verify

- Reload the preview, watch the network tab: the two failing requests should return 200/`[]`.
- Locally, attempt a fresh sign-up; confirm it succeeds and lands in `auth.users`.
- Open the Profile page and the wizard; brand-memory and draft auto-save should stop logging schema errors.

## Out of scope

- No app/UI code changes.
- No auth provider changes (Google OAuth, HIBP, etc.) — sign-in works once env is correct.
- No edits to `src/integrations/supabase/client.ts` or `types.ts`. Types will regenerate automatically after the migrations run.
