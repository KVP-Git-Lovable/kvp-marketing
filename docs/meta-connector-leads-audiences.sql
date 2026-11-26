-- Meta Ads Connector: customer-list audiences and retrieved leads. Additive only.
create table if not exists public.meta_connector_audiences (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  account_id text not null,
  external_id text not null,
  name text not null,
  row_count integer not null default 0,
  invalid_count integer not null default 0,
  duplicate_count integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.meta_connector_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.meta_connector_campaigns(id) on delete cascade,
  lead_id text not null,
  form_id text not null,
  ad_id text,
  created_time timestamptz,
  fields jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
revoke all on public.meta_connector_audiences, public.meta_connector_leads from anon, authenticated;
grant select on public.meta_connector_audiences, public.meta_connector_leads to authenticated;
grant all on public.meta_connector_audiences, public.meta_connector_leads to service_role;
alter table public.meta_connector_audiences enable row level security;
alter table public.meta_connector_leads enable row level security;
drop policy if exists meta_connector_audiences_read on public.meta_connector_audiences;
create policy meta_connector_audiences_read on public.meta_connector_audiences for select to authenticated
  using (public.user_has_permission(auth.uid(), 'comm_meta_connector_campaigns', 'can_read'));
drop policy if exists meta_connector_leads_read on public.meta_connector_leads;
create policy meta_connector_leads_read on public.meta_connector_leads for select to authenticated
  using (public.user_has_permission(auth.uid(), 'comm_meta_connector_campaigns', 'can_read'));
