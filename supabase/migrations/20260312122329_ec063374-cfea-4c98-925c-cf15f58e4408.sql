
-- 1. Add plan_status column to fy_target_config
ALTER TABLE fy_target_config 
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'draft';

-- Migrate existing data based on is_locked
UPDATE fy_target_config SET plan_status = 'active' WHERE is_locked = true;
UPDATE fy_target_config SET plan_status = 'draft' WHERE is_locked = false;

-- 2. Drop unique constraint on fy_year to allow multiple plans per FY
ALTER TABLE fy_target_config DROP CONSTRAINT IF EXISTS fy_target_config_fy_year_key;

-- Add composite unique on (fy_year, target_plan_name) instead
ALTER TABLE fy_target_config ADD CONSTRAINT fy_target_config_fy_year_plan_name_key UNIQUE (fy_year, target_plan_name);

-- 3. Create target_breakdowns table
CREATE TABLE IF NOT EXISTS target_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_config_id uuid REFERENCES fy_target_config(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parameter_type text NOT NULL,
  parameter_id text NOT NULL,
  parameter_name text NOT NULL,
  month_number int,
  quantity_target numeric DEFAULT 0,
  revenue_target numeric DEFAULT 0,
  visits_target numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for target_breakdowns
ALTER TABLE target_breakdowns ENABLE ROW LEVEL SECURITY;

-- Users can read their own breakdowns
CREATE POLICY "Users can read own breakdowns" ON target_breakdowns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert/update/delete (admin check done at app level)
CREATE POLICY "Authenticated users can manage breakdowns" ON target_breakdowns
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON target_breakdowns TO authenticated;
GRANT ALL ON target_breakdowns TO anon;
