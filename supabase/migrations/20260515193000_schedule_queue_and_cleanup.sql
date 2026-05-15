-- Schedule the queue worker and orphan media cleanup as Supabase Edge Function invocations.
-- Assumes the project ref from supabase/config.toml and verify_jwt=false on these functions.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'social-spark-queue-worker') then
    perform cron.schedule(
      'social-spark-queue-worker',
      '* * * * *',
      $$
        select net.http_post(
          url := 'https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/queue-worker',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := '{"mode":"process"}'::jsonb
        );
      $$
    );
  end if;

  if not exists (select 1 from cron.job where jobname = 'social-spark-cleanup-media') then
    perform cron.schedule(
      'social-spark-cleanup-media',
      '15 3 * * *',
      $$
        select net.http_post(
          url := 'https://mbxlvsftyifovbkpsvyw.supabase.co/functions/v1/cleanup-media',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := '{"maxAgeHours":24}'::jsonb
        );
      $$
    );
  end if;
end $do$;
