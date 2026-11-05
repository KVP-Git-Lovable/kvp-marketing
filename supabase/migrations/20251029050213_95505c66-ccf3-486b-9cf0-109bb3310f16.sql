-- Add new fields to branding_request_items for status tracking
ALTER TABLE branding_request_items 
ADD COLUMN IF NOT EXISTS current_stage text,
ADD COLUMN IF NOT EXISTS approved_budget numeric,
ADD COLUMN IF NOT EXISTS pending_status text;