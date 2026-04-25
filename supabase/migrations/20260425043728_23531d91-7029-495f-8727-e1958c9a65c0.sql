-- Status enum for scheduled_posts
DO $$ BEGIN
  CREATE TYPE public.scheduled_post_status AS ENUM ('drafted','approved','published','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- scheduled_posts: workflow columns
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS workflow_status public.scheduled_post_status NOT NULL DEFAULT 'drafted',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- profiles: default timezone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_timezone text;

-- saved_calendars: tz override, tracking link, per-post hashtag locks
ALTER TABLE public.saved_calendars
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS locked_hashtags jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workflow_status
  ON public.scheduled_posts(user_id, workflow_status);