ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS key_mode TEXT NOT NULL DEFAULT 'fallback' CHECK (key_mode IN ('fallback', 'always'));
