-- F-001: User-owned UPDATE policies lack WITH CHECK, allowing row-ownership hijack.
-- Without WITH CHECK, USING only gates the *old* row, so a user can UPDATE a row
-- they currently own and reassign user_id to another user (row planting/theft).
-- This migration recreates each affected UPDATE policy with matching USING and
-- WITH CHECK clauses so the new row must also belong to the caller.

-- profiles
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- saved_calendars
DROP POLICY IF EXISTS "Users update own calendars" ON public.saved_calendars;
CREATE POLICY "Users update own calendars" ON public.saved_calendars
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- templates
DROP POLICY IF EXISTS "Users update own templates" ON public.templates;
CREATE POLICY "Users update own templates" ON public.templates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- wizard_drafts
DROP POLICY IF EXISTS "Users update own wizard drafts" ON public.wizard_drafts;
CREATE POLICY "Users update own wizard drafts" ON public.wizard_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- scheduled_posts
DROP POLICY IF EXISTS "Users update own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Users update own scheduled posts" ON public.scheduled_posts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_settings
DROP POLICY IF EXISTS "Users can update own user settings" ON public.user_settings;
CREATE POLICY "Users can update own user settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
