#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions and apply DB migration for trends ingestion
# Requires: supabase CLI installed and authenticated, psql available for migration

if [ -z "${SUPABASE_PROJECT_REF-}" ]; then
  echo "Please set SUPABASE_PROJECT_REF environment variable." >&2
  exit 1
fi

echo "Deploying Supabase Edge Functions for trends..."
supabase functions deploy queue_worker --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy trends_ingest --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy trends_read --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy trends_admin --project-ref "$SUPABASE_PROJECT_REF"

echo "Applying DB migration..."
if [ -z "${SUPABASE_DB_CONN-}" ]; then
  echo "SUPABASE_DB_CONN not set; please run SQL manually or set SUPABASE_DB_CONN." >&2
  exit 0
fi

psql "$SUPABASE_DB_CONN" -f migrations/0001_create_trending_topics_table.sql

echo "Deployment complete. Remember to set function secrets (SUPABASE_SERVICE_ROLE_KEY, X_BEARER_TOKEN, NEWSAPI_KEY, SENTRY_DSN, PUSHGATEWAY_URL) in your deployment environment." 
