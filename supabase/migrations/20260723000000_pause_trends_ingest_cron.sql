-- PENDING OWNER APPROVAL: do NOT apply this migration without explicit owner sign-off.
-- Pauses the daily trends-ingest cron (trend surfaces are hidden behind trends_enabled=false).
-- To resume, re-run the schedule from 20260708120000_trends_pipeline_and_indexing.sql.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'social-spark-trends-ingest';
