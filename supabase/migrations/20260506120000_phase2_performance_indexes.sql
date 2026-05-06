-- Additional database optimizations for Phase 2 performance improvements
-- Add composite index for calendar queries with timezone filtering
CREATE INDEX IF NOT EXISTS idx_saved_calendars_user_created
  ON public.saved_calendars (user_id, created_at DESC)
  WHERE timezone IS NOT NULL;

-- Add index for scheduled posts by calendar (for status queries)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_calendar_status
  ON public.scheduled_posts (calendar_id, workflow_status);

-- Optimize profiles queries by adding index on frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_profiles_user_defaults
  ON public.profiles (user_id)
  WHERE default_timezone IS NOT NULL OR default_voice IS NOT NULL;