-- =============================================================================
-- Agendar digest matinal (07:00 America/Sao_Paulo = 10:00 UTC)
-- Pré-requisitos: extensões pg_cron e pg_net ativas no projeto Supabase.
-- Substitui YOUR_PROJECT_REF e YOUR_CRON_SECRET antes de executar.
-- O valor de YOUR_CRON_SECRET deve ser o mesmo secret CRON_SECRET da Edge Function.
-- =============================================================================

-- Opcional: remover job com o mesmo nome antes de reagendar (pode falhar se não existir).
-- select cron.unschedule('daily-task-digest-brt7');

select
  cron.schedule(
    'daily-task-digest-brt7',
    '0 10 * * *', -- minuto 0, hora 10 UTC
    $$
    select
      net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-task-digest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_CRON_SECRET'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );
