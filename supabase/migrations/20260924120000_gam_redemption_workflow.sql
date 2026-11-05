-- The redemption workflow: request, decide, pay.
--
-- Until now a redemption was a client-side INSERT. The browser checked the
-- amount against a balance it computed itself, and RLS checked only that you
-- were inserting a row about yourself -- who you are, not what you can afford --
-- so a direct REST call could post any number. Approving was a plain UPDATE on
-- the same table and never deducted anything, so the same balance funded every
-- request. The screen that did it has since been deleted; it was unreachable.
--
-- Three guarded steps replace that, and the split the whole workflow exists for
-- lives between the second and the third: gam_decide_redemption records a
-- DECISION, gam_mark_redemption_paid records an EVENT. Only the second burns
-- points, because only the second means money has left.
--
-- The settings table already carried a redemption policy that nothing read --
-- redeem_min_points, redeem_multiple_of, redeem_max_per_request,
-- redeem_cooldown_days, redeem_requires_approval. These functions enforce it
-- rather than inventing new rules. NOTE: redeem_min_points is currently 0 while
-- the app hard-codes a minimum of 100, so configure it if 100 is the intent.


-- Who may act on somebody's request.
--
-- Anyone above the requester in the reporting chain, plus admins. The self-check
-- is not an extra: approving your own payout is the one thing this workflow must
-- not allow, and the biggest earner on staging is also a system admin, so
-- without it the control is decorative.
create or replace function public.gam_can_action_redemption(p_requester uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and p_requester is not null
     and p_requester <> auth.uid()
     and (
       coalesce(public.is_admin_or_manager(), false)
       or exists (
         select 1 from public.get_all_subordinates(auth.uid()) s
         where s.subordinate_user_id = p_requester and s.level > 0
       )
     );
$function$;

revoke all on function public.gam_can_action_redemption(uuid) from public;
grant execute on function public.gam_can_action_redemption(uuid) to authenticated;


-- Does this caller have a queue to look at? Drives whether the tab is shown.
create or replace function public.gam_has_redemption_queue()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and (
       coalesce(public.is_admin_or_manager(), false)
       or exists (select 1 from public.get_all_subordinates(auth.uid()) s where s.level > 0)
     );
$function$;

revoke all on function public.gam_has_redemption_queue() from public;
grant execute on function public.gam_has_redemption_queue() to authenticated;


-- STEP 1 -- the rep asks.
create or replace function public.gam_request_redemption(p_points numeric)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me        uuid := auth.uid();
  v_s         record;
  v_available numeric;
  v_rate      numeric;
  v_last      timestamptz;
  v_id        uuid;
  v_status    text;
  v_mgr       uuid;
  v_name      text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a redemption' USING ERRCODE = '42501';
  END IF;
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Enter how many points to redeem';
  END IF;

  SELECT * INTO v_s FROM public.gamification_settings LIMIT 1;

  IF NOT COALESCE(v_s.engine_enabled, true) THEN
    RAISE EXCEPTION 'Rewards are currently switched off';
  END IF;

  -- The balance is re-read here rather than trusted from the caller. This is
  -- the check the browser was doing alone.
  v_available := public.gam_available_to_redeem(v_me);
  IF p_points > v_available THEN
    RAISE EXCEPTION 'You have % points available to redeem', trunc(v_available)
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_s.redeem_min_points, 0) > 0 AND p_points < v_s.redeem_min_points THEN
    RAISE EXCEPTION 'Minimum redemption is % points', v_s.redeem_min_points
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_s.redeem_max_per_request, 0) > 0 AND p_points > v_s.redeem_max_per_request THEN
    RAISE EXCEPTION 'Maximum per request is % points', v_s.redeem_max_per_request
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_s.redeem_multiple_of, 0) > 0 AND (p_points % v_s.redeem_multiple_of) <> 0 THEN
    RAISE EXCEPTION 'Redeem in multiples of % points', v_s.redeem_multiple_of
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_s.redeem_cooldown_days, 0) > 0 THEN
    SELECT max(requested_at) INTO v_last
    FROM public.gamification_redemptions
    WHERE user_id = v_me AND status <> 'cancelled';

    IF v_last IS NOT NULL AND v_last > now() - make_interval(days => v_s.redeem_cooldown_days) THEN
      RAISE EXCEPTION 'You can request again after %',
        to_char(v_last + make_interval(days => v_s.redeem_cooldown_days), 'DD Mon YYYY')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Persisted, so it is read at submit time and never recomputed from a rate
  -- that may since have changed.
  v_rate := COALESCE(v_s.point_conversion, 1);

  -- Approval can be switched off, but payment cannot: the request still has to
  -- be marked paid by a human, it just skips the decision step.
  v_status := CASE WHEN COALESCE(v_s.redeem_requires_approval, true)
                   THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.gamification_redemptions
    (user_id, points_redeemed, voucher_amount, status, requested_at,
     approved_at)
  VALUES
    (v_me, p_points, p_points * v_rate, v_status, now(),
     CASE WHEN v_status = 'approved' THEN now() END)
  RETURNING id INTO v_id;

  -- Tell the managers. Nothing told anyone before, which is why a request could
  -- sit at pending indefinitely with no one aware it existed.
  IF v_status = 'pending' THEN
    SELECT COALESCE(full_name, username, 'A team member') INTO v_name
    FROM public.profiles WHERE id = v_me;

    FOR v_mgr IN SELECT m FROM public.notif_managers_up_chain(v_me) m LOOP
      IF public.gam_is_active_user(v_mgr) THEN
        PERFORM public.send_notification(
          v_mgr,
          'Redemption request',
          format('%s requested %s points (%s%s).', v_name, trunc(p_points),
                 '₹', trunc(p_points * v_rate)),
          'info', 'gamification_redemptions', v_id);
      END IF;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$function$;

revoke all on function public.gam_request_redemption(numeric) from public;
grant execute on function public.gam_request_redemption(numeric) to authenticated;


-- STEP 2 -- a manager decides. A decision only; no money has moved.
create or replace function public.gam_decide_redemption(
  p_id      uuid,
  p_approve boolean,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me   uuid := auth.uid();
  v_r    record;
  v_avail numeric;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF NOT public.gam_can_action_redemption(v_r.user_id) THEN
    RAISE EXCEPTION 'You cannot action this request' USING ERRCODE = '42501';
  END IF;

  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already %', v_r.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_approve THEN
    -- Re-checked at the moment of approval, not at request time. A correction
    -- posted in between -- exactly what happened with the tier bug -- must not
    -- be approved through.
    v_avail := public.gam_available_to_redeem(v_r.user_id) + v_r.points_redeemed;
    IF v_r.points_redeemed > v_avail THEN
      RAISE EXCEPTION 'Their balance no longer covers this request (% available)', trunc(v_avail)
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.gamification_redemptions
       SET status = 'approved', approved_by = v_me, approved_at = now()
     WHERE id = p_id;

    PERFORM public.send_notification(
      v_r.user_id, 'Redemption approved',
      format('Your %s point redemption was approved. Payment is being arranged.',
             trunc(v_r.points_redeemed)),
      'success', 'gamification_redemptions', p_id);
  ELSE
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      RAISE EXCEPTION 'Give a reason -- it is the only thing the rep will see';
    END IF;

    UPDATE public.gamification_redemptions
       SET status = 'rejected', rejection_reason = btrim(p_reason),
           processed_by = v_me, processed_at = now()
     WHERE id = p_id;

    PERFORM public.send_notification(
      v_r.user_id, 'Redemption rejected', btrim(p_reason),
      'warning', 'gamification_redemptions', p_id);
  END IF;
END;
$function$;

revoke all on function public.gam_decide_redemption(uuid, boolean, text) from public;
grant execute on function public.gam_decide_redemption(uuid, boolean, text) to authenticated;


-- STEP 3 -- the reward actually went out. The only step that burns points.
create or replace function public.gam_mark_redemption_paid(
  p_id        uuid,
  p_mode      text,
  p_reference text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me uuid := auth.uid();
  v_r  record;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF NOT public.gam_can_action_redemption(v_r.user_id) THEN
    RAISE EXCEPTION 'You cannot action this request' USING ERRCODE = '42501';
  END IF;

  -- Only from approved. Paying something nobody approved would make the
  -- approval step optional, which is the failure this workflow is designed
  -- around.
  IF v_r.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved request can be marked paid (this one is %)', v_r.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_mode IS NULL OR btrim(p_mode) = '' OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Record how it was paid and a reference';
  END IF;

  -- Burns exactly points_redeemed, splitting the last award. Raises rather than
  -- under-paying if the inventory has moved since approval, which aborts the
  -- whole function and leaves the request approved.
  PERFORM public.gam_burn_points(v_r.user_id, v_r.points_redeemed, p_id);

  UPDATE public.gamification_redemptions
     SET status = 'paid', paid_by = v_me, paid_at = now(),
         payment_mode = btrim(p_mode),
         payment_reference = btrim(p_reference),
         payment_note = nullif(btrim(coalesce(p_note, '')), ''),
         voucher_code = coalesce(voucher_code, btrim(p_reference))
   WHERE id = p_id;

  PERFORM public.send_notification(
    v_r.user_id, 'Reward sent',
    format('%s%s redemption has been sent.', '₹', trunc(v_r.voucher_amount)),
    'success', 'gamification_redemptions', p_id);
END;
$function$;

revoke all on function public.gam_mark_redemption_paid(uuid, text, text, text) from public;
grant execute on function public.gam_mark_redemption_paid(uuid, text, text, text) to authenticated;


-- The rep changes their mind, while it is still theirs to change.
create or replace function public.gam_cancel_redemption(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me uuid := auth.uid();
  v_r  record;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;
  IF v_r.user_id <> v_me THEN
    RAISE EXCEPTION 'That is not your request' USING ERRCODE = '42501';
  END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Once a manager has actioned it, it is no longer yours to withdraw'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.gamification_redemptions
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_id;
END;
$function$;

revoke all on function public.gam_cancel_redemption(uuid) from public;
grant execute on function public.gam_cancel_redemption(uuid) to authenticated;


-- The manager's queue.
--
-- Returns only requests this caller may act on, with the requester's balance
-- beside the amount -- approving without it is approving blind, which is how a
-- request got raised against points the tier bug had inflated.
create or replace function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id)
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_action_redemption(r.user_id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$;

revoke all on function public.gam_redemption_queue(text[]) from public;
grant execute on function public.gam_redemption_queue(text[]) to authenticated;


-- The rep's own list, with the names behind each step so the timeline can say
-- "approved by Dharmesh" rather than "approved".
create or replace function public.gam_my_redemptions()
returns table (
  id uuid,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  rejection_reason text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.rejection_reason
  from public.gamification_redemptions r
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where r.user_id = auth.uid()
  order by r.requested_at desc;
$function$;

revoke all on function public.gam_my_redemptions() from public;
grant execute on function public.gam_my_redemptions() to authenticated;


-- RLS: reading stays open to the people who should read; WRITING now happens
-- only inside the functions above.
--
-- The blanket "Admins can manage all redemptions" ALL policy is replaced by
-- SELECT and DELETE. DELETE is kept because user archiving cascades through
-- this table; UPDATE is granted to nobody, so no path exists that changes a
-- status without going through the burn and the audit columns. The user INSERT
-- policy goes for the same reason: a request is made by calling
-- gam_request_redemption, which is where the balance is actually checked.
drop policy if exists "Admins can manage all redemptions"            on public.gamification_redemptions;
drop policy if exists "Users can create their own redemption requests" on public.gamification_redemptions;
drop policy if exists "Users can view their own redemptions"         on public.gamification_redemptions;

create policy "Redemptions are visible to the rep and their managers"
  on public.gamification_redemptions
  for select
  using (
    auth.uid() = user_id
    or coalesce(public.is_admin_or_manager(), false)
    or coalesce(public.report_can_view_user(auth.uid(), user_id), false)
  );

create policy "Admins can delete redemptions"
  on public.gamification_redemptions
  for delete
  using (coalesce(public.is_admin_or_manager(), false));
