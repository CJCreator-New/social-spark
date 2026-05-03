-- Remove any duplicate scheduled rows for the same calendar/day, keeping the most recent
DELETE FROM public.scheduled_posts a
USING public.scheduled_posts b
WHERE a.calendar_id = b.calendar_id
  AND a.post_day = b.post_day
  AND a.created_at < b.created_at;

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_calendar_day_unique UNIQUE (calendar_id, post_day);