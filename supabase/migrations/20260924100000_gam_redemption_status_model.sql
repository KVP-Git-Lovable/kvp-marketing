-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions
  add column if not exists approved_by        uuid references auth.users(id),
  add column if not exists approved_at        timestamptz,
  add column if not exists paid_by            uuid references auth.users(id),
  add column if not exists paid_at            timestamptz,
  add column if not exists payment_mode       text,
  add column if not exists payment_reference  text,
  add column if not exists payment_note       text,
  add column if not exists cancelled_at       timestamptz;

comment on column public.gamification_redemptions.approved_at is
  'When a manager approved. NOT when the reward was given -- see paid_at.';
comment on column public.gamification_redemptions.paid_at is
  'When the reward actually reached the rep. Only this step burns points.';
comment on column public.gamification_redemptions.payment_reference is
  'UTR, voucher code or payroll run that the rep can be pointed at.';

-- Drop first so the migration is re-runnable against a half-applied database.
alter table public.gamification_redemptions
  drop constraint if exists gamification_redemptions_status_check;

alter table public.gamification_redemptions
  add constraint gamification_redemptions_status_check
  check (status in ('pending', 'approved', 'paid', 'rejected', 'cancelled'));

-- A request for nothing, or for a negative amount, is not a request. The client
-- checked this and the server did not, so a direct REST call could post any
-- number at all.
alter table public.gamification_redemptions
  drop constraint if exists gamification_redemptions_amount_check;

alter table public.gamification_redemptions
  add constraint gamification_redemptions_amount_check
  check (points_redeemed > 0 and voucher_amount >= 0);

-- The queue reads "oldest waiting first", per status.
create index if not exists gamification_redemptions_status_requested_idx
  on public.gamification_redemptions (status, requested_at);

create index if not exists gamification_redemptions_user_idx
  on public.gamification_redemptions (user_id, requested_at desc);


-- One definition of what a person may redeem.
--
-- There were two. gam_user_balance counts active, unexpired award rows; the
-- Leaderboard screen summed EVERY row regardless of status or expiry and
-- subtracted open requests in the browser. They agree today only because
-- nothing has ever been burned -- the moment a payment flips rows to
-- 'redeemed', the screen keeps counting them and reports a balance the server
-- would refuse.
--
-- This is that single definition: the real balance, less what is already
-- committed to requests that have not been settled. A 'paid' request is not
-- subtracted, because its points have left the balance by being burned;
-- subtracting it as well would charge the rep twice.
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
          select sum(r.points_redeemed)
          from public.gamification_redemptions r
          where r.user_id = p_user
            and r.status in ('pending', 'approved')
        ), 0)
  );
$function$;

revoke all on function public.gam_available_to_redeem(uuid) from public;
grant execute on function public.gam_available_to_redeem(uuid) to authenticated;
