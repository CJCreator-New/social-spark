Param(
  [Parameter(Mandatory=$true)] [string]$ProjectRef
)

# PowerShell deploy script for Supabase Edge Functions and migration
Write-Host "Deploying Supabase Edge Functions for trends..."
supabase functions deploy queue_worker --project-ref $ProjectRef
supabase functions deploy trends_ingest --project-ref $ProjectRef
supabase functions deploy trends_read --project-ref $ProjectRef
supabase functions deploy trends_admin --project-ref $ProjectRef

Write-Host "Applying DB migration..."
if (-not $env:SUPABASE_DB_CONN) {
  Write-Warning "SUPABASE_DB_CONN not set; please run SQL manually or set SUPABASE_DB_CONN."
  exit 0
}

$cmd = "psql $env:SUPABASE_DB_CONN -f migrations/0001_create_trending_topics_table.sql"
Invoke-Expression $cmd
Write-Host "Deployment complete. Set function secrets in Supabase project settings: SUPABASE_SERVICE_ROLE_KEY, X_BEARER_TOKEN, NEWSAPI_KEY, SENTRY_DSN, PUSHGATEWAY_URL"
