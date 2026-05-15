# Deployment Setup

Use this checklist to enable the background jobs and Edge Functions added for queue processing, telemetry, and media cleanup.

## Edge Functions

Deploy these functions from the `supabase/functions/` folder:

- `queue-worker`
- `cleanup-media`
- `telemetry`
- `generate-calendar`
- `generate-single-post`
- `regenerate-post`

The functions are configured with `verify_jwt = false` in `supabase/config.toml` so Supabase cron and the client telemetry sender can reach them directly.

## Database Migrations

Apply the new migrations in order:

1. `supabase/migrations/20260515190000_queue_media_telemetry.sql`
2. `supabase/migrations/20260515193000_schedule_queue_and_cleanup.sql`

These create:

- `job_queue` for retryable background jobs
- `telemetry_events` for event capture
- `media_references` for media cleanup tracking
- cron jobs for the queue worker and orphan cleanup

## Scheduled Jobs

- Queue worker: every minute
- Media cleanup: daily at 03:15 UTC

The queue worker processes pending jobs with retry/backoff.
The media cleanup function removes orphaned files after verifying they are not referenced by a profile avatar or a DB-backed media reference.

## Verification

After deploy, check:

1. Supabase logs for `queue-worker` and `cleanup-media` executions.
2. The `cron.job` table for the scheduled jobs.
3. `telemetry_events` rows after using the app.
4. `job_queue` rows moving through `pending -> processing -> completed/failed`.
