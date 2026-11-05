-- Correct the two balances the tier bug overpaid.
--
-- Until 20260921120000, both award functions ignored tier_mode and paid every
-- rung at or below the achievement. Two people reached 100% of a six-rung
-- target and were paid all six — 1,800 where the top rung is worth 375.
--
--   Abhishek KP   period 2026-08   paid 1,800   owed 375   over by 1,425
--   Ashwitha      period 2026-09   paid 1,800   owed 375   over by 1,425
--
-- Vindya reached only the 10% rung, was paid 150, and is already correct.
--
-- Nothing is deleted. Two ledger rows carry the correction, dated to the same
-- instant as the awards they offset so they land in the same period, and
-- carrying the same expiry so they cannot outlive what they correct. The
-- drill-down shows them as records, which is the point: a balance that changed
-- should say why rather than quietly differ from what someone was told.
--
-- After this the engine agrees: gam_award_tiers_for_target sums what the period
-- has already paid (375) against what the top rung owes (375) and awards
-- nothing further.
--
-- Written to be safe to run twice — the guard is the correction row itself.
insert into public.gamification_points
  (user_id, game_id, action_id, points, reference_type,
   earned_at, expires_at, status, period_key, metadata)
select v.user_id, v.game_id, v.action_id, v.points, 'target_tier',
       v.earned_at, v.expires_at, 'active', v.period_key,
       jsonb_build_object(
         'correction', true,
         'reason', 'tier_mode=highest was not honoured: every rung was paid instead of only the highest reached',
         'paid_before', 1800,
         'owed', 375,
         'fixed_by', '20260921120000_gam_tier_mode_highest')
from (values
  ('cadd4c26-bc9c-4d71-8a05-35d3169d2206'::uuid,   -- Ashwitha
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-09'::text,
   '2026-09-01 11:47:36.942505+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz),
  ('6be7e2ff-0447-44a0-a3b5-64993b9db54d'::uuid,   -- Abhishek KP
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-08'::text,
   '2026-09-01 10:07:06.076649+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz)
) as v(user_id, game_id, action_id, points, period_key, earned_at, expires_at)
where not exists (
  select 1 from public.gamification_points gp
  where gp.user_id = v.user_id
    and gp.action_id = v.action_id
    and gp.period_key = v.period_key
    and gp.reference_type = 'target_tier'
    and coalesce((gp.metadata->>'correction')::boolean, false)
);
