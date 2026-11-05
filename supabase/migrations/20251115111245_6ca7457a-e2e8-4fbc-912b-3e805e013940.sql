-- Add new fields to competition_master table
ALTER TABLE public.competition_master
ADD COLUMN IF NOT EXISTS focus TEXT,
ADD COLUMN IF NOT EXISTS strategy TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS sales_team_size INTEGER,
ADD COLUMN IF NOT EXISTS supply_chain_info TEXT,
ADD COLUMN IF NOT EXISTS head_office TEXT,
ADD COLUMN IF NOT EXISTS regional_offices_count INTEGER;