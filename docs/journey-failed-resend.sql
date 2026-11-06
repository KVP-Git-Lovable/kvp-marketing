-- Failed-message resend: schedule table + cron. Additive only; no existing table is changed.
create table if not exists public.journey_retry_schedule (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.journey_message_log(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed','skipped','cancelled')),
  result_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists journey_retry_schedule_due_idx on public.journey_retry_schedule (status, scheduled_for);
alter table public.journey_retry_schedule enable row level security;
drop policy if exists journey_retry_schedule_select on public.journey_retry_schedule;
create policy journey_retry_schedule_select on public.journey_retry_schedule for select to authenticated using (true);
-- inserts/updates happen only through the journey-retry edge function (service role).

-- Run every 5 minutes (same token pattern as process-journeys-5min).
select cron.schedule('journey-retry-5min', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://fuicsoheofipzbmomdtv.supabase.co/functions/v1/journey-retry',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(select token from public.journey_cron_token limit 1)),
    body := '{"action":"process_due"}'::jsonb
  );
$$);
