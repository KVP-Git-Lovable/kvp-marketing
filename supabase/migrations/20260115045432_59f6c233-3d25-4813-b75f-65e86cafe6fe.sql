-- Phase 1 Part 2: Create Packing List Tables

-- 1.2 Create packing_lists table
CREATE TABLE IF NOT EXISTS packing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_number TEXT UNIQUE NOT NULL DEFAULT '',
  delivery_date DATE NOT NULL,
  distributor_id UUID REFERENCES distributors(id),
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  total_orders INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Create packing_list_assignments table
CREATE TABLE IF NOT EXISTS packing_list_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id UUID REFERENCES packing_lists(id) ON DELETE CASCADE,
  agent_id UUID,
  van_id UUID,
  beat_ids TEXT[],
  territory_ids UUID[],
  order_count INTEGER DEFAULT 0,
  total_load_qty INTEGER DEFAULT 0,
  total_load_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'assigned',
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Create packing_list_items table (aggregated product view)
CREATE TABLE IF NOT EXISTS packing_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id UUID REFERENCES packing_lists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit TEXT,
  ordered_qty INTEGER DEFAULT 0,
  picked_qty INTEGER DEFAULT 0,
  short_qty INTEGER DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Function to generate packing list number
CREATE OR REPLACE FUNCTION generate_packing_list_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.packing_list_number IS NULL OR NEW.packing_list_number = '' THEN
    SELECT COALESCE(MAX(
      CASE 
        WHEN packing_list_number ~ '^PL-[0-9]{8}-[0-9]+$' 
        THEN CAST(SPLIT_PART(packing_list_number, '-', 3) AS INTEGER)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM packing_lists 
    WHERE delivery_date = NEW.delivery_date;
    
    NEW.packing_list_number := 'PL-' || TO_CHAR(NEW.delivery_date, 'YYYYMMDD') || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_generate_packing_list_number ON packing_lists;
CREATE TRIGGER trigger_generate_packing_list_number
  BEFORE INSERT ON packing_lists
  FOR EACH ROW
  EXECUTE FUNCTION generate_packing_list_number();

-- Enable RLS on new tables
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for packing_lists
CREATE POLICY "Users can view packing lists"
  ON packing_lists FOR SELECT
  USING (true);

CREATE POLICY "Users can create packing lists"
  ON packing_lists FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update packing lists"
  ON packing_lists FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete draft packing lists"
  ON packing_lists FOR DELETE
  USING (status = 'draft');

-- RLS Policies for packing_list_assignments
CREATE POLICY "Users can view packing list assignments"
  ON packing_list_assignments FOR SELECT
  USING (true);

CREATE POLICY "Users can manage packing list assignments"
  ON packing_list_assignments FOR ALL
  USING (true);

-- RLS Policies for packing_list_items
CREATE POLICY "Users can view packing list items"
  ON packing_list_items FOR SELECT
  USING (true);

CREATE POLICY "Users can manage packing list items"
  ON packing_list_items FOR ALL
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_packing_lists_delivery_date ON packing_lists(delivery_date);
CREATE INDEX IF NOT EXISTS idx_packing_lists_status ON packing_lists(status);
CREATE INDEX IF NOT EXISTS idx_packing_lists_distributor ON packing_lists(distributor_id);
CREATE INDEX IF NOT EXISTS idx_packing_list_assignments_packing_list ON packing_list_assignments(packing_list_id);
CREATE INDEX IF NOT EXISTS idx_packing_list_assignments_agent ON packing_list_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_packing_list_items_packing_list ON packing_list_items(packing_list_id);