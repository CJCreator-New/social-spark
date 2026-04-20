ALTER TABLE public.saved_calendars
  ADD COLUMN IF NOT EXISTS week_start_date date,
  ADD COLUMN IF NOT EXISTS post_times jsonb,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_saved_calendars_user_fav
  ON public.saved_calendars (user_id, is_favorite);