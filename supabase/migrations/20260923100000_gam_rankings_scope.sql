-- Whose rankings you are looking at.
--
-- gam_rankings returned every user who had ever earned a point, company-wide,
-- with no scope and — the live bug — no active filter, so a deactivated user
-- stayed on the board indefinitely. Suyog is is_active = false and holds
-- points; he is absent from the September board only because he earned nothing
-- that month.
--
-- Three scopes now:
--   hierarchy  your chain, your peers, you, and everyone under you
--   mine       you and everyone under you
--   selected   exactly the people passed in
--
-- "Active" follows the rule report_all_managers() already uses — profiles
-- .is_active AND no past employees.date_of_exit — rather than inventing a
-- fourth definition alongside is_active, user_status and date_of_exit.
--
-- The recursion walks the WHOLE tree and filters for display only at the end.
-- Filtering mid-walk would cut the branch at an inactive manager: Shravan.k is
-- active and reports to the inactive Suyog, and would lose Prajwalkvp and
-- Dharmesh from his chain entirely.

-- Active by the app's existing definition. A profile with no employees row is
-- still active if its profile says so — those users have no exit date to fail.
create or replace function public.gam_is_active_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    left join public.employees e on e.user_id = p.id
    where p.id = p_user
      and p.is_active = true
      and (e.date_of_exit is null or e.date_of_exit > now())
  );
$function$;

revoke all on function public.gam_is_active_user(uuid) from public;
grant execute on function public.gam_is_active_user(uuid) to authenticated;


-- The set of people one scope covers, for the signed-in caller. Takes no user
-- parameter on purpose: the caller is always auth.uid(), so this cannot be
-- used to enumerate somebody else's reporting line.
create or replace function public.gam_scope_users(
  p_scope text default 'hierarchy',
  p_selected uuid[] default null
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with me as (select auth.uid() as uid),
  -- Everyone above me, to the root. Walked in full; inactive links are
  -- traversed rather than stopped at.
  chain as (
    with recursive up as (
      select e.manager_id as uid
      from public.employees e, me
      where e.user_id = me.uid and e.manager_id is not null
      union
      select e.manager_id
      from public.employees e join up on e.user_id = up.uid
      where e.manager_id is not null
    )
    select uid from up
  ),
  -- Everyone reporting to my manager, which includes me.
  peers as (
    select sib.user_id as uid
    from public.employees mine, me
    join public.employees sib on sib.manager_id = mine.manager_id
    where mine.user_id = me.uid and mine.manager_id is not null
  ),
  reports as (
    select s.subordinate_user_id as uid
    from me, public.get_all_subordinates(me.uid) s
    where s.level > 0
  ),
  candidate as (
    select uid from (
      select uid from chain where p_scope = 'hierarchy'
      union select uid from peers where p_scope = 'hierarchy'
      union select uid from reports where p_scope in ('hierarchy', 'mine')
      -- You are always on your own board; a leaderboard you cannot find
      -- yourself on is not a leaderboard.
      union select uid from me where p_scope in ('hierarchy', 'mine')
      union select unnest(coalesce(p_selected, '{}'::uuid[])) where p_scope = 'selected'
    ) s where uid is not null
  )
  select c.uid
  from candidate c
  where public.gam_is_active_user(c.uid);
$function$;

revoke all on function public.gam_scope_users(text, uuid[]) from public;
grant execute on function public.gam_scope_users(text, uuid[]) to authenticated;


-- Active users the picker may offer. Names only; no points, no hierarchy.
create or replace function public.gam_selectable_users()
returns table (user_id uuid, full_name text, profile_picture_url text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.id,
         coalesce(p.full_name, p.username, 'Unknown')::text,
         p.profile_picture_url
  from public.profiles p
  left join public.employees e on e.user_id = p.id
  where auth.uid() is not null
    and p.is_active = true
    and (e.date_of_exit is null or e.date_of_exit > now())
  order by 2;
$function$;

revoke all on function public.gam_selectable_users() from public;
grant execute on function public.gam_selectable_users() to authenticated;


-- The board itself. RANK() is computed over the filtered set, so a scoped
-- board reads 1, 2, 3 rather than 1, 4, 9.
--
-- An explicitly selected user appears even on zero, because picking someone
-- and not seeing them reads as a broken filter. A hierarchy or team board
-- still lists only people who have earned something, which is how it has
-- always behaved.
drop function if exists public.gam_rankings(timestamptz, timestamptz);

create function public.gam_rankings(
  p_from timestamptz,
  p_to timestamptz,
  p_scope text default 'hierarchy',
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  full_name text,
  profile_picture_url text,
  points numeric,
  awards bigint,
  programs bigint,
  rank bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (
    select s.user_id as uid from public.gam_scope_users(p_scope, p_user_ids) s
  ),
  agg as (
    select e.user_id,
           sum(e.points) as points,
           count(*) as awards,
           count(distinct e.game_id) as programs
    from public.gam_eligible_points(p_from, p_to) e
    join scope sc on sc.uid = e.user_id
    where e.user_id is not null
    group by e.user_id
  ),
  rows as (
    select sc.uid as user_id,
           coalesce(a.points, 0) as points,
           coalesce(a.awards, 0) as awards,
           coalesce(a.programs, 0) as programs
    from scope sc
    left join agg a on a.user_id = sc.uid
    -- Zeros are kept only for an explicit selection.
    where a.user_id is not null or p_scope = 'selected'
  )
  select r.user_id,
         coalesce(p.full_name, p.username, 'Unknown') as full_name,
         p.profile_picture_url,
         r.points, r.awards, r.programs,
         rank() over (order by r.points desc) as rank
  from rows r
  join public.profiles p on p.id = r.user_id
  order by r.points desc, full_name;
$function$;

revoke all on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) from public;
grant execute on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) to authenticated;
