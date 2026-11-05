-- Milestone rungs compare with "is at least", not "equals".
--
-- Two rungs were saved with operator '=', so a ₹500 threshold meant exactly
-- ₹500.00 — ₹501 failed, and so did ₹499. For a milestone threshold that is
-- never the intent.
--
-- Scoped to tier rungs only. Two exact-match rules elsewhere are deliberate
-- and are left alone:
--   "Every cash order"      payment_mode = cash   (a string equality; enabled)
--   "20 visits completed"   visit_count  = 20     (a condition, disabled)
--
-- Only rungs are touched, and only those still on '='.
update public.activity_tiers
set operator = '>='
where order_ordinal is not null
  and operator = '=';
