-- Journey Campaign, Phase A (already applied to the live Lovable Cloud database on 2026-11-05).
-- Record only: do not run again, and intentionally not in a migrations folder.
-- Additive and nullable; no backfill. journeys.status check is unchanged in this phase.

alter table public.journeys
  add column if not exists objective text,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists budget_cap numeric,
  add column if not exists description text;

alter table public.journeys add constraint journeys_objective_check
  check (objective is null or objective in ('lead_generation','engagement','awareness','conversion','re_engagement','event_promotion'));
alter table public.journeys add constraint journeys_budget_cap_check
  check (budget_cap is null or budget_cap >= 0);
alter table public.journeys add constraint journeys_dates_check
  check (start_date is null or end_date is null or end_date > start_date);
