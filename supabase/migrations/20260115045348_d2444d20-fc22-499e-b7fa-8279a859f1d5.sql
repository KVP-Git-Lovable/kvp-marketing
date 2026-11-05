-- Phase 1: D-1 Order Collection + D-Day Delivery System - Complete Schema

-- 1.1 Extend orders table for delivery workflow
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_list_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_van_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS short_items JSONB;

-- Add indexes for orders delivery columns
CREATE INDEX IF NOT EXISTS idx_orders_packing_list ON orders(packing_list_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);

-- Add feature flags for gradual rollout
INSERT INTO feature_flags (feature_key, feature_name, description, category, is_enabled)
VALUES 
  ('d1_delivery', 'D-1 Order Collection', 'Enable D-1 order collection with D-day delivery workflow', 'Delivery', false),
  ('packing_list_module', 'Packing List Management', 'Enable packing list creation and management for delivery planning', 'Delivery', false),
  ('delivery_agent_app', 'Delivery Agent Interface', 'Enable mobile delivery execution interface for agents', 'Delivery', false)
ON CONFLICT (feature_key) DO NOTHING;