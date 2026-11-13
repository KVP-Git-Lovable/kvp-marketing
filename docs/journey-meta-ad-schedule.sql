-- Meta Ad node schedule + pause/resume tracking. Additive only.
alter table public.journey_meta_ad_links
  add column if not exists applied_start_at timestamptz,
  add column if not exists applied_end_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists last_error text,
  add column if not exists paused_by_journey boolean not null default false;
