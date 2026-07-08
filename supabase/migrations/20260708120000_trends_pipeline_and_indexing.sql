-- Migration: Support trends pipeline scheduling and optimize read queries
-- Description: Adds last_seen column, creates indexes, and schedules the daily ingest cron.

-- 1. Add last_seen column to trends table
ALTER TABLE public.trends ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Optimize read queries by creating index
CREATE INDEX IF NOT EXISTS trends_category_volume_idx ON public.trends (category, volume DESC);

-- 3. Schedule the trends-ingest cron job (runs every day at 4:00 AM)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule first if exists to prevent duplicates
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'social-spark-trends-ingest';

SELECT cron.schedule(
  'social-spark-trends-ingest',
  '0 4 * * *',
  $$
    select net.http_post(
      url := 'https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/trends-ingest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
