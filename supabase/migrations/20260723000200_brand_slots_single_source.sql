-- Phase 3: the brand slot becomes the single source for voice, audience and
-- hashtag policy. Columns are additive and nullable; existing rows stay valid.
ALTER TABLE public.brand_slots
  ADD COLUMN IF NOT EXISTS voice TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS audiences TEXT[],
  ADD COLUMN IF NOT EXISTS goals TEXT[],
  ADD COLUMN IF NOT EXISTS required_phrases TEXT[],
  ADD COLUMN IF NOT EXISTS banned_hashtags TEXT[],
  ADD COLUMN IF NOT EXISTS required_hashtags TEXT[];
