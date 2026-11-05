-- Burn exactly what was redeemed, and nothing else.
--
-- gam_redeem_points walked a user's active awards oldest-first and flipped each
-- whole row to 'redeemed' until a counter ran out. Two things were wrong with
-- that, and both destroy points:
--
--   1. No remainder. A 375-point award used to settle a 100-point redemption
--      was flipped in full, and the other 275 vanished.
--   2. Negative rows. A correction row of -1425 is 'active', so the loop
--      subtracted a negative -- the counter GREW and the walk kept going.
--
-- Simulated against Abhishek's real ledger, redeeming 100 points burned 850
-- across 22 rows. The function was called by nothing, so this never fired in
-- production; wiring it up as it stood would have been the bug.
--
-- It is dropped rather than repaired, because leaving a broken primitive named
-- "redeem points" beside a correct one invites somebody to call the wrong one.
drop function if exists public.gam_redeem_points(uuid, numeric);

-- Corrections are netted, never spent.
--
-- Only positive award rows are consumed, but gam_user_balance nets the negative
-- ones, so the arithmetic still lands: Abhishek holds 4,025 in positive rows
-- and -2,850 in corrections for a balance of 1,175. Burning 1,175 of the
-- positives leaves 2,850 against -2,850 -- a balance of zero, which is right.
-- Because the caller has already checked the balance, positive inventory is
-- always sufficient; the shortfall RAISE is a guard, not a path.
create or replace function public.gam_burn_points(
  p_user       uuid,
  p_amount     numeric,
  p_redemption uuid
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  r        record;
  v_left   numeric := p_amount;
  v_take   numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be positive';
  END IF;

  FOR r IN
    SELECT id, points
    FROM public.gamification_points
    WHERE user_id = p_user
      AND status = 'active'
      AND points > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY earned_at ASC, id ASC
    -- Locked so two concurrent payouts cannot consume the same award. Without
    -- this, approving and paying twice in quick succession double-spends.
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;

    v_take := LEAST(r.points, v_left);

    IF v_take = r.points THEN
      -- The whole award pays for part of this redemption.
      UPDATE public.gamification_points
         SET status = 'redeemed', redemption_id = p_redemption
       WHERE id = r.id;
    ELSE
      -- Only part of it is needed. The original row keeps the remainder and
      -- stays active; the consumed part becomes its own redeemed row carrying
      -- the same attribution, so the period roll-up still sums to the same
      -- total and the award can still be traced to its order and retailer.
      UPDATE public.gamification_points
         SET points = r.points - v_take
       WHERE id = r.id;

      INSERT INTO public.gamification_points
        (action_id, points, reference_type, reference_id, earned_at, metadata,
         user_id, game_id, expires_at, status, period_key, retailer_id, redemption_id)
      SELECT action_id, v_take, reference_type, reference_id, earned_at,
             coalesce(metadata, '{}'::jsonb) || jsonb_build_object('split_from', gp.id::text),
             user_id, game_id, expires_at, 'redeemed', period_key, retailer_id, p_redemption
      FROM public.gamification_points gp
      WHERE gp.id = r.id;
    END IF;

    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION 'Not enough redeemable points: short by %', v_left
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN p_amount;
END;
$function$;

revoke all on function public.gam_burn_points(uuid, numeric, uuid) from public;
-- Nobody calls this directly. It runs inside gam_mark_redemption_paid, which is
-- where the entitlement check lives; granting it to authenticated would let any
-- signed-in caller burn anyone's points.
