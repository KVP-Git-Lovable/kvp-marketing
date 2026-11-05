-- Gamification overview: who the report counts.
--
-- Two complaints, one answer -- the report is about the people who are on the
-- team TODAY:
--   * a deactivated user (or one whose employment has ended) still carried
--     points into every total, so the headline, the per-game rows and the
--     "who earned it" drill-downs all described a roster that no longer exists;
--   * a person who earned nothing vanished from the list entirely, which reads
--     as "everyone is participating" when the truth is the opposite. Nil is a
--     result, and it is the one a manager is looking for.
--
-- gam_is_active_user() is the module's existing definition of active (profile
-- enabled AND not past an exit date). It is inlined below as an EXISTS rather
-- than called per row, so the planner can semi-join ~9k award rows instead of
-- invoking a SECURITY DEFINER function 9k times.

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
            and pr.is_active = true
            and (e.date_of_exit is null or e.date_of_exit > now())
       )
     )
   group by p.game_id, p.user_id;
$$;

-- The roster the overview lists against, so somebody who earned nothing is
-- shown at zero instead of being absent. Same definition of "active" as above,
-- kept in the database so the list and the totals can never disagree.
create or replace function public.gam_active_people()
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select pr.id,
         coalesce(nullif(btrim(pr.full_name), ''), 'Unnamed')
    from public.profiles pr
    left join public.employees e on e.user_id = pr.id
   where pr.is_active = true
     and (e.date_of_exit is null or e.date_of_exit > now())
   -- a person with more than one employee row must still be one row here
   group by pr.id, pr.full_name
   order by 2;
$$;

revoke all on function public.gam_active_people() from public;
grant execute on function public.gam_active_people() to authenticated;
