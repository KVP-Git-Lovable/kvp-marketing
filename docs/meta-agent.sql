-- Agentic Meta Campaign: conversations/plans and recommendations. Additive only.
create table if not exists public.meta_agent_runs (
  id uuid primary key,
  created_by uuid not null,
  messages jsonb not null default '[]'::jsonb,
  plan jsonb,
  campaign_id uuid,
  status text not null default 'chatting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.meta_agent_recommendations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.meta_connector_campaigns(id) on delete cascade,
  campaign_name text not null,
  kind text not null check (kind in ('pause','increase_budget','new_creative')),
  reason text not null,
  explanation text,
  evidence jsonb not null default '{}'::jsonb,
  proposal jsonb,
  status text not null default 'pending' check (status in ('pending','applying','applied','rejected','acknowledged','failed','superseded')),
  result_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz
);
create index if not exists meta_agent_recommendations_campaign_idx on public.meta_agent_recommendations (campaign_id, status);
revoke all on public.meta_agent_runs, public.meta_agent_recommendations from anon, authenticated;
grant select on public.meta_agent_runs, public.meta_agent_recommendations to authenticated;
grant all on public.meta_agent_runs, public.meta_agent_recommendations to service_role;
alter table public.meta_agent_runs enable row level security;
alter table public.meta_agent_recommendations enable row level security;
drop policy if exists meta_agent_runs_own on public.meta_agent_runs;
create policy meta_agent_runs_own on public.meta_agent_runs for select to authenticated
  using (created_by = auth.uid());
drop policy if exists meta_agent_recommendations_read on public.meta_agent_recommendations;
create policy meta_agent_recommendations_read on public.meta_agent_recommendations for select to authenticated
  using (public.user_has_permission(auth.uid(), 'comm_meta_connector_campaigns', 'can_read'));
