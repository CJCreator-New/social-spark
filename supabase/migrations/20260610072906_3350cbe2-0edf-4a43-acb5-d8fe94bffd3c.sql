
-- 1. wizard_drafts table
-- (Already idempotent vs. 20260508173000_create_wizard_drafts.sql via IF NOT EXISTS;
-- this pass adds the explicit authenticated/service_role grants the first migration lacked.)
CREATE TABLE IF NOT EXISTS public.wizard_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wizard_drafts TO authenticated;
GRANT ALL ON public.wizard_drafts TO service_role;

ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own wizard drafts" ON public.wizard_drafts FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert own wizard drafts" ON public.wizard_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own wizard drafts" ON public.wizard_drafts FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete own wizard drafts" ON public.wizard_drafts FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_wizard_drafts_user ON public.wizard_drafts(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_wizard_drafts_updated ON public.wizard_drafts;
CREATE TRIGGER trg_wizard_drafts_updated BEFORE UPDATE ON public.wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. profiles missing columns (brand memory + brand examples)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_examples text[],
  ADD COLUMN IF NOT EXISTS default_framework text,
  ADD COLUMN IF NOT EXISTS forbidden_phrases text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS proof_points text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cta_preferences text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_structures text[] DEFAULT '{}'::text[];
