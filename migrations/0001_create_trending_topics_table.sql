-- Migration: create trending_topics table
-- Run in Supabase / Postgres environment. Requires `pgcrypto` for gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trending_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id text,
  title text NOT NULL,
  normalized_terms text[] DEFAULT ARRAY[]::text[],
  industry text,
  platform text,
  score numeric DEFAULT 0,
  signal_count int DEFAULT 1,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  dedupe_hash text,
  raw_payload jsonb,
  confidence numeric,
  processed boolean DEFAULT false,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint for source+source_id when present
CREATE UNIQUE INDEX IF NOT EXISTS trending_topics_source_sourceid_idx
  ON trending_topics (source, source_id)
  WHERE source_id IS NOT NULL;

-- Indexes for read patterns
CREATE INDEX IF NOT EXISTS trending_topics_industry_platform_score_idx
  ON trending_topics (industry, platform, score DESC);

CREATE INDEX IF NOT EXISTS trending_topics_dedupe_hash_idx
  ON trending_topics (dedupe_hash);

-- Optional: materialized view for top trending per industry/platform can be created by ops scripts.
