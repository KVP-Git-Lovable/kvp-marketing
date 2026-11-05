-- "Active" has TWO switches in this schema, and gamification was only reading one.
--
-- profiles.is_active is the older flag; profiles.user_status is the enum the user
-- management screen actually drives (UserProfileAssignment writes BOTH, but not
-- everything that has ever deactivated someone did). In production two people are
-- is_active = true AND user_status = 'inactive' -- the duplicate "Girish " and
-- "MANVITH " rows -- so they kept appearing in the gamification report after being
-- switched off.
--
-- The app's own rule, used verbatim everywhere else in the codebase (see
-- BeatAssignmentTab, BeatCoordinatorSidebar, LeaveCoverageTab, RepSidebar), is:
--
--     (user_status ?? 'active') === 'active' && is_active !== false
--
-- plus, for gamification, no past employment exit date. That is now the single
-- definition below, and the two reporting functions inline exactly the same
-- predicate -- inlined rather than called, so the planner can semi-join ~9k award
-- rows instead of invoking a SECURITY DEFINER function per row.

create or replace function public.gam_is_active_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.profiles p
      left join public.employees e on e.user_id = p.id
     where p.id = p_user
       and p.is_active is not false
       and coalesce(p.user_status::text, 'active') = 'active'
       and (e.date_of_exit is null or e.date_of_exit > now())
  );
$$;

create or replace function public.gam_active_people()
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id,
         coalesce(nullif(btrim(p.full_name), ''), 'Unnamed')
    from public.profiles p
    left join public.employees e on e.user_id = p.id
   where p.is_active is not false
     and coalesce(p.user_status::text, 'active') = 'active'
     and (e.date_of_exit is null or e.date_of_exit > now())
   -- a person with more than one employee row must still be one row here
   group by p.id, p.full_name
   order by 2;
$$;

create or replace function public.gamification_points_rollup(
  p_from date default null,
  p_to   date default null
)
returns table(game_id uuid, user_id uuid, points numeric, awards bigint, last_earned timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.game_id,
         p.user_id,
         coalesce(sum(p.points), 0)::numeric,
         count(*)::bigint,
         max(p.earned_at)
    from gamification_points p
   where (p_from is null or p.earned_at >= p_from::timestamptz)
     -- half-open on the upper bound so the caller's "to" day is included whole,
     -- whatever the time component of the rows in it.
     and (p_to   is null or p.earned_at <  (p_to + 1)::timestamptz)
     -- user_id IS NULL is not a person, so it keeps its place: the UI shows it
     -- as "Not linked to a person" and the totals still reconcile with the
     -- ledger. Only real people are tested for being current.
     and (
       p.user_id is null
       or exists (
         select 1
           from public.profiles pr
           left join public.employees e on e.user_id = pr.id
          where pr.id = p.user_id
            and pr.is_active is not false
            and coalesce(pr.user_status::text, 'active') = 'active'
            and (e.date_of_exit is null or e.date_of_exit > now())
       )
     )
   group by p.game_id, p.user_id;
$$;
