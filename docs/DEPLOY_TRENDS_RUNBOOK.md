# Trending Ingestion Runbook

What this repo contains
- SQL migration: [migrations/0001_create_trending_topics_table.sql](migrations/0001_create_trending_topics_table.sql)
- Edge Function stubs: [supabase/functions/*](supabase/functions/)
- Frontend client: [src/lib/trendsApi.ts](src/lib/trendsApi.ts)

Quick deploy steps (manual)
1. Apply DB migration to Supabase/Postgres (run the SQL in the project's Supabase DB).
2. Create a service role key in Supabase and store it in your deployment secrets (EDGE_FUNCTION_SERVICE_KEY).
3. Implement adapters with real API keys and credentials.
4. Deploy Edge Functions to Supabase (or an alternative serverless platform). Use the `supabase functions deploy` CLI.
5. Schedule `queue_worker` to run at desired intervals (cron or Supabase scheduled functions) to ingest and upsert trends.
6. Expose the `trends_read` function behind a CDN path and update `src/lib/trendsApi.ts` DEFAULT_ENDPOINT.

Monitoring & Ops
- Log ingestion counts, adapter failures, API rate-limit hits, and upsert errors to your logging service (Logflare/Datadog/Sentry).
- Add alerts for repeated adapter failures or large error spikes.

Monitoring & Alerting (implementation notes)
- Initialize Sentry by setting `SENTRY_DSN` in deployment secrets and calling the project's monitoring init helper.
- Log adapter errors and upsert failures to Sentry with tags `adapter:<name>`.
- Add simple alert rules: >5 adapter failures in 10 minutes, or queue_worker ingestion count drops to 0 for 3 consecutive runs.
- Use Supabase's logs + external monitoring for function timeouts and rate-limit warnings.

Deploy scripts
- A small deploy helper is available at `scripts/deploy_trends.sh` (UNIX) and `scripts/deploy_trends.ps1` (PowerShell). It deploys Edge Functions and attempts to apply the SQL migration. Example:

```bash
export SUPABASE_PROJECT_REF=your-project-ref
export SUPABASE_DB_CONN="postgres://user:pass@host:5432/postgres"
./scripts/deploy_trends.sh
```

Environment variables
- Copy `.env.trends.example` to your deployment secrets or `.env` file and fill in the values. Required values for runtime:
	- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
	- `X_BEARER_TOKEN`, `NEWSAPI_KEY` (or adapter-specific credentials)
	- `SENTRY_DSN` (optional), `PUSHGATEWAY_URL` (optional)


Notes on security
- Never commit service role keys to the repo. Use environment/deployment secrets.
- Protect ingest endpoints (require signed token or deploy them behind internal-only network).
