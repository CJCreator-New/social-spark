-- Migration: Create trends table
-- Description: Tracks keyword volume, category, source, and timestamps for trend-driven content generation.

CREATE TABLE IF NOT EXISTS public.trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on keyword and source to facilitate easy upserting
ALTER TABLE public.trends ADD CONSTRAINT unique_keyword_source UNIQUE (keyword, source);

-- Enable Row Level Security
ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read it
CREATE POLICY "Allow authenticated users to read trends" ON public.trends
  FOR SELECT TO authenticated USING (true);

-- Allow service role to perform all operations
GRANT ALL ON public.trends TO service_role;

-- Grant select to authenticated users
GRANT SELECT ON public.trends TO authenticated;

-- Trigger to maintain updated_at column
CREATE TRIGGER trg_trends_updated_at
  BEFORE UPDATE ON public.trends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
