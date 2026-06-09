# Deployment Setup

Use this checklist to enable the background jobs, Edge Functions, storage buckets, and database migrations added for queue processing, telemetry, media cleanup, AI-powered generation, and brand memory.

## Edge Functions

Deploy these functions from the `supabase/functions/` folder:

### Core Functions
- `generate-calendar`
- `generate-single-post`
- `regenerate-post`

### Premium AI Functions
- **`repurpose-post`**: Adapts post copy to fit platform conventions.
- **`generate-post-image`**: Triggers generative imagery models and saves output PNG assets.
- **`inline-rewrite`**: Micro-editing helper for rewriting target text sections.

### Infrastructure & Cleanup Functions
- `queue-worker`
- `cleanup-media`
- `telemetry`

### Trend Ingestion Functions (See [DEPLOY_TRENDS_RUNBOOK.md](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/docs/DEPLOY_TRENDS_RUNBOOK.md))
- `trends_admin`
- `trends_ingest`
- `trends_read`

The functions are configured with `verify_jwt = false` in `supabase/config.toml` so Supabase cron and the client telemetry sender can reach them directly. Secure endpoints check appropriate rate limits or API bearer tokens.

## Database Migrations

Apply database migrations in chronological order (located in `supabase/migrations/`):

1. **`20260515190000_queue_media_telemetry.sql` & `20260515193000_schedule_queue_and_cleanup.sql`**:
   - Creates `job_queue` for background workers.
   - Sets up `telemetry_events` table.
   - Configures pg_cron jobs for execution.
2. **`20260602143000_post_images_bucket.sql`**:
   - Creates the public `post-images` storage bucket.
   - Adds storage security policies enabling users to upload and manage visual assets within their own authentication folders.
3. **`20260602_add_profile_brand_examples.sql` & `20260604103000_add_brand_memory.sql`**:
   - Adds support for `brand_memory` fields (custom brand examples, voice rules, preferred phrases, target audience, and forbidden keywords).
4. **`20260604052346_secure_metrics_and_performance.sql`**:
   - Enables Row-Level Security (RLS) on all scheduling and metrics tables.
   - Enforces that users can only read or edit metrics matching their UUID.

## Storage Configuration

The system relies on a Supabase Storage bucket named **`post-images`**.
- Ensure the bucket is created and set to public.
- The `20260602143000_post_images_bucket.sql` migration automatically handles the RLS rules for this bucket:
  - Users can read all images (public).
  - Users can only insert/update/delete files under their own authenticated folder prefix: `(storage.foldername(name))[1] = auth.uid()::text`.

## Scheduled Jobs

- **Queue worker**: Runs every minute to process pending social publication jobs.
- **Media cleanup**: Runs daily at 03:15 UTC to scan for orphaned media uploads and delete them from storage.

## Verification

After deployment, verify:
1. Supabase logs for `queue-worker`, `cleanup-media`, and AI edge function executions.
2. The `cron.job` table to verify scheduling tasks.
3. Object storage to check if files generated via `generate-post-image` are stored in the `post-images` bucket.
4. RLS settings to verify that a client cannot query performance metrics of posts owned by another user.
