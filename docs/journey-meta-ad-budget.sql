-- Meta Ad node budget + cached spend. Additive only.
alter table public.journey_meta_ad_links
  add column if not exists applied_budget numeric,
  add column if not exists applied_budget_type text,
  add column if not exists spend_amount numeric,
  add column if not exists spend_synced_at timestamptz;
