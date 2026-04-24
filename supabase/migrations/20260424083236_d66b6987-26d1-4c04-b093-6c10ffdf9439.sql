
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_hashtags TEXT[],
  ADD COLUMN IF NOT EXISTS required_hashtags TEXT[];

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  calendar_id UUID NOT NULL REFERENCES public.saved_calendars(id) ON DELETE CASCADE,
  post_day INT NOT NULL CHECK (post_day BETWEEN 1 AND 7),
  platform TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  post_snapshot JSONB NOT NULL,
  copy_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, post_day)
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scheduled posts" ON public.scheduled_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own scheduled posts" ON public.scheduled_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own scheduled posts" ON public.scheduled_posts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_time
  ON public.scheduled_posts (user_id, scheduled_at);
