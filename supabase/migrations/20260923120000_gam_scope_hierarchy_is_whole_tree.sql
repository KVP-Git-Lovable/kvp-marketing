-- "My hierarchy" is the whole connected tree, not a neighbourhood of it.
--
-- It previously meant your chain, your peers and your reports. It now means:
-- climb to the root of your tree, then take everyone under that root. Two
-- unrelated org trees therefore never mix — somebody in tree 1 sees 1..9 and
-- never sees A..J, which is the point of the change.
--
-- Verified on a synthetic two-tree org matching the spec: viewers B, C, I and
-- J all resolve to root A and see A..J; viewers 3 and 9 resolve to root 1 and
-- see 1..9. On the live org there is currently only ONE root (Dharmesh), so
-- every active user is in one tree and this scope shows all of them — the
-- separation matters the moment a second tree exists.
--
-- The upward walk deliberately passes THROUGH inactive people: Shravan.k is
-- active and reports to the inactive Suyog, and stopping there would leave him
-- rootless and alone on his own board. Activity is a display filter, applied
-- once at the end, never a break in the tree.
--
-- depth < 20 guards a manager cycle. get_all_subordinates already blocks
-- self-reference, but nothing stops a longer loop, and an unbounded recursive
-- CTE over cyclic data does not return.
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
  -- The top of my tree. Someone with no employees row is their own root and
  -- sees only themselves, which is correct: they belong to no tree.
  root as (
    with recursive up as (
      select me.uid as uid, 0 as depth from me where me.uid is not null
      union all
      select e.manager_id, up.depth + 1
      from public.employees e
      join up on e.user_id = up.uid
      where e.manager_id is not null and up.depth < 20
    )
    select up.uid from up order by up.depth desc limit 1
  ),
  tree as (
    select s.subordinate_user_id as uid
    from root, public.get_all_subordinates(root.uid) s
  ),
  reports as (
    select s.subordinate_user_id as uid
    from me, public.get_all_subordinates(me.uid) s
    where s.level > 0
  ),
  candidate as (
    select uid from (
      select uid from tree where p_scope = 'hierarchy'
      union select uid from reports where p_scope = 'mine'
      -- You are always on your own board.
      union select uid from me where p_scope in ('hierarchy', 'mine')
      union select unnest(coalesce(p_selected, '{}'::uuid[])) where p_scope = 'selected'
    ) s where uid is not null
  )
  select c.uid
  from candidate c
  where public.gam_is_active_user(c.uid);
$function$;
