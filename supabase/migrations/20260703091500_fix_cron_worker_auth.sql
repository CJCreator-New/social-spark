-- queue-worker / cleanup-media previously authorized callers by comparing an
-- `x-service-key` header against SUPABASE_SERVICE_ROLE_KEY itself — and the
-- cron jobs below never even sent that header, so both invocations were
-- always rejected with 401 (the queue/cleanup pipeline was silently dead).
--
-- Fix: authorize with a dedicated, lower-privilege secret
-- (INTERNAL_CRON_SECRET, checked in supabase/functions/_shared/promptHelpers.ts
-- verifyCronSecret()) instead of the service role key, and have pg_cron send
-- it by reading it out of Supabase Vault at call time so it never appears in
-- migration/version-control history.
--
-- One-time manual step required after this migration runs: set the edge
-- function secret to match the vault value, e.g.
--   supabase secrets set INTERNAL_CRON_SECRET="$(psql -c "select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret'" -tA)"

create extension if not exists supabase_vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $do$
begin
  if not exists (select 1 from vault.secrets where name = 'internal_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'internal_cron_secret');
  end if;
end $do$;

select cron.unschedule(jobid) from cron.job where jobname = 'social-spark-queue-worker';
select cron.unschedule(jobid) from cron.job where jobname = 'social-spark-cleanup-media';

select cron.schedule(
  'social-spark-queue-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/queue-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{"mode":"process"}'::jsonb
    );
  $$
);

select cron.schedule(
  'social-spark-cleanup-media',
  '15 3 * * *',
  $$
    select net.http_post(
      url := 'https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/cleanup-media',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{"maxAgeHours":24}'::jsonb
    );
  $$
);
