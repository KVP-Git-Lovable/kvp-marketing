-- Journey Campaign, Phase B (database part applied to the live Lovable Cloud database on 2026-11-05).
-- Record only: do not run again, and intentionally not in a migrations folder.

-- 1) New 'scheduled' status (a campaign with a future start_date waits here until the sweep starts it).
alter table public.journeys drop constraint journeys_status_check;
alter table public.journeys add constraint journeys_status_check
  check (status = any (array['draft','scheduled','active','paused','completed','archived']));

-- 2) Token the scheduler presents to process-journeys (x-cron-token header).
--    RLS on, no policies, no client grants: only the service role / postgres can read it.
create table if not exists public.journey_cron_token (token text primary key);
alter table public.journey_cron_token enable row level security;
revoke all on public.journey_cron_token from anon, authenticated;
insert into public.journey_cron_token (token)
  select encode(sha256((gen_random_uuid()::text || gen_random_uuid()::text)::bytea), 'hex')
  where not exists (select 1 from public.journey_cron_token);

-- 3) The 5-minute sweep (created after the function change was deployed). The token is read at run time,
--    so rotating it is just an UPDATE on journey_cron_token.
-- select cron.schedule('process-journeys-5min', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://fuicsoheofipzbmomdtv.supabase.co/functions/v1/process-journeys',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(select token from public.journey_cron_token limit 1)),
--     body := '{}'::jsonb);
-- $$);
