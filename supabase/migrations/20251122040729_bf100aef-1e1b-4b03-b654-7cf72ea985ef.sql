-- First, update existing region values to match new constraint
-- Set default region for any that don't match
UPDATE territories 
SET region = 'District' 
WHERE region IS NOT NULL 
  AND region NOT IN ('State', 'District', 'Taluk', 'Gram Panchayat');

-- Add new columns to territories table for hierarchy and additional fields
ALTER TABLE territories 
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES territories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS child_territories_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population integer,
  ADD COLUMN IF NOT EXISTS target_market_size numeric,
  ADD COLUMN IF NOT EXISTS retailer_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competitor_ids uuid[],
  ADD COLUMN IF NOT EXISTS territory_type text CHECK (territory_type IN ('City', 'Town', 'Village'));

-- Update region column to use CHECK constraint
ALTER TABLE territories 
  ADD CONSTRAINT territories_region_check 
  CHECK (region IN ('State', 'District', 'Taluk', 'Gram Panchayat'));

-- Create territory assignment history table
CREATE TABLE IF NOT EXISTS territory_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL,
  assigned_from timestamp with time zone NOT NULL,
  assigned_to timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on territory assignment history
ALTER TABLE territory_assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for territory assignment history
CREATE POLICY "Authenticated users can view assignment history"
  ON territory_assignment_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage assignment history"
  ON territory_assignment_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to update child territories count
CREATE OR REPLACE FUNCTION update_child_territories_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent's child count when a territory is added/updated with a parent
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE territories
    SET child_territories_count = (
      SELECT COUNT(*) 
      FROM territories 
      WHERE parent_id = NEW.parent_id
    )
    WHERE id = NEW.parent_id;
  END IF;
  
  -- Update old parent's count if parent changed
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id AND OLD.parent_id IS NOT NULL THEN
    UPDATE territories
    SET child_territories_count = (
      SELECT COUNT(*) 
      FROM territories 
      WHERE parent_id = OLD.parent_id
    )
    WHERE id = OLD.parent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update child count
DROP TRIGGER IF EXISTS update_child_count_trigger ON territories;
CREATE TRIGGER update_child_count_trigger
  AFTER INSERT OR UPDATE ON territories
  FOR EACH ROW
  EXECUTE FUNCTION update_child_territories_count();

-- Function to update child count on delete
CREATE OR REPLACE FUNCTION update_child_territories_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    UPDATE territories
    SET child_territories_count = (
      SELECT COUNT(*) 
      FROM territories 
      WHERE parent_id = OLD.parent_id
    )
    WHERE id = OLD.parent_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_child_count_on_delete_trigger ON territories;
CREATE TRIGGER update_child_count_on_delete_trigger
  AFTER DELETE ON territories
  FOR EACH ROW
  EXECUTE FUNCTION update_child_territories_count_on_delete();

-- Function to track territory assignment changes
CREATE OR REPLACE FUNCTION track_territory_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Close previous assignment when user changes
  IF TG_OP = 'UPDATE' AND OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id THEN
    -- Close old assignment
    IF OLD.assigned_user_id IS NOT NULL THEN
      UPDATE territory_assignment_history
      SET assigned_to = now()
      WHERE territory_id = OLD.id 
        AND assigned_user_id = OLD.assigned_user_id 
        AND assigned_to IS NULL;
    END IF;
    
    -- Create new assignment
    IF NEW.assigned_user_id IS NOT NULL THEN
      INSERT INTO territory_assignment_history (territory_id, assigned_user_id, assigned_from)
      VALUES (NEW.id, NEW.assigned_user_id, now());
    END IF;
  END IF;
  
  -- Create initial assignment on insert
  IF TG_OP = 'INSERT' AND NEW.assigned_user_id IS NOT NULL THEN
    INSERT INTO territory_assignment_history (territory_id, assigned_user_id, assigned_from)
    VALUES (NEW.id, NEW.assigned_user_id, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS track_territory_assignment_trigger ON territories;
CREATE TRIGGER track_territory_assignment_trigger
  AFTER INSERT OR UPDATE ON territories
  FOR EACH ROW
  EXECUTE FUNCTION track_territory_assignment();

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_territories_parent_id ON territories(parent_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignment_history_territory_id ON territory_assignment_history(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignment_history_user_id ON territory_assignment_history(assigned_user_id);