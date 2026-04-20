ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_voice text,
  ADD COLUMN IF NOT EXISTS default_style text,
  ADD COLUMN IF NOT EXISTS default_audiences text[],
  ADD COLUMN IF NOT EXISTS default_goals text[];