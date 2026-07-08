-- Migration: Persistent per-user idea backlog
-- Description: Backs the idea backlog currently stored only in localStorage
-- (src/lib/ideaBacklog.ts) with a real table, so ideas survive across
-- devices/sessions. Follows this repo's existing RLS pattern (idempotent
-- policy creation via DO $$ ... EXCEPTION WHEN duplicate_object) and applies
-- WITH CHECK on the UPDATE policy from day one (see
-- 20260707000000_add_with_check_to_update_policies.sql for the historical
-- gap this avoids repeating).

CREATE TABLE IF NOT EXISTS public.idea_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  angle TEXT NOT NULL,
  format TEXT,
  rationale TEXT,
  key_points TEXT,
  source_snippet TEXT,
  platform TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.idea_backlog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own idea backlog" ON public.idea_backlog
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own idea backlog" ON public.idea_backlog
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own idea backlog" ON public.idea_backlog
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own idea backlog" ON public.idea_backlog
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partial index for the common "unused ideas" backlog view.
CREATE INDEX IF NOT EXISTS idx_idea_backlog_user_unused
  ON public.idea_backlog (user_id, created_at DESC)
  WHERE used_at IS NULL;

-- General per-user recency index.
CREATE INDEX IF NOT EXISTS idx_idea_backlog_user_created
  ON public.idea_backlog (user_id, created_at DESC);

CREATE TRIGGER trg_idea_backlog_updated BEFORE UPDATE ON public.idea_backlog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
