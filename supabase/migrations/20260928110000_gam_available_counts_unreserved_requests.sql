-- "Available to redeem" must also hold back requests that were never reserved.
--
-- Reservation moves the points backing a request out of 'active', so
-- gam_user_balance already excludes them and available is simply the balance.
-- That is true only for requests raised through gam_redeem_request. Rows that
-- predate reservation hold nothing: their points are still spendable while the
-- request sits open, so the balance overstates what the rep may ask for.
--
-- Dharmesh is the live case -- 110 approved and unpaid since June, no
-- reservation behind it, and 1,243 shown as available. It fails closed today
-- rather than over-paying, because gam_burn_points refuses when the inventory
-- is short: he could redeem the lot and the 110 would then fail to pay. That
-- is a stuck payment and a confusing one, so the amount is held back instead.
--
-- Subtracting the SHORTFALL rather than the whole request is what makes this
-- correct for both kinds of row at once: a fully reserved request has a
-- shortfall of zero and is already accounted for in the balance, a legacy one
-- has a shortfall equal to its full amount, and a partially reserved one --
-- which should not exist, but would otherwise be counted twice or not at all --
-- is held back by exactly the part nothing is holding.
create or replace function public.gam_available_to_redeem(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(
    0,
    public.gam_user_balance(p_user)
      - coalesce((
          select sum(
                   greatest(
                     0,
                     r.points_redeemed - coalesce((
                       select sum(gp.points)
                       from public.gamification_points gp
                       where gp.redemption_id = r.id
                         and gp.status = 'reserved'
                     ), 0)
                   )
                 )
          from public.gamification_redemptions r
          where r.user_id = p_user
            and r.status in ('pending', 'approved')
        ), 0)
  );
$function$;
