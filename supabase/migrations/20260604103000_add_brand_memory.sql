-- Add brand memory columns to profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS forbidden_phrases text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS proof_points text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cta_preferences text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_structures text[] DEFAULT '{}'::text[];
