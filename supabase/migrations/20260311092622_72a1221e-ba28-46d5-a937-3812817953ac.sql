
-- Add expense policy columns to expense_master_config
ALTER TABLE expense_master_config
  ADD COLUMN IF NOT EXISTS max_additional_expense_per_day numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_additional_expense_per_month numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS require_bill_above_amount numeric DEFAULT 500,
  ADD COLUMN IF NOT EXISTS allowed_categories text[] DEFAULT ARRAY['food', 'travel', 'accommodation', 'communication', 'other'],
  ADD COLUMN IF NOT EXISTS da_calculation_basis text DEFAULT 'per_day' CHECK (da_calculation_basis IN ('per_day', 'per_half_day')),
  ADD COLUMN IF NOT EXISTS ta_per_km_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_policy_notes text DEFAULT '';
