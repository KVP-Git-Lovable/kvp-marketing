-- Redemptions always settle on the first response.
--
-- The "Decision rule" control is gone from Redemption Configuration. It chose
-- between first-response and unanimous, but unanimous only means anything for a
-- ladder -- levels of the reporting chain, approving in turn -- and redemptions
-- route to a flat set of alternatives in every mode except Manager on its own.
-- With the approval process now a multi-select, the question it asked is
-- already answered by which routes are ticked, and a control that is disabled
-- in most configurations and meaningless in the rest is worth removing rather
-- than explaining.
--
-- Removing the control is not enough on its own: a value left at true would be
-- stuck true, silently making approvals sequential with nothing in the UI able
-- to change it back. So it is pinned false for this entity type.
--
-- require_all_levels itself stays. It is a column on the SHARED approval_config
-- and leave, expenses, regularisation, credit notes, order backdates and order
-- edits all read it through process_approval_step; only the redemption row is
-- touched here.
update public.approval_config
   set require_all_levels = false,
       updated_at = now()
 where entity_type = 'gamification_redemption'
   and require_all_levels is distinct from false;
