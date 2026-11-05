-- Add km tracking columns to van_stock table
ALTER TABLE van_stock
ADD COLUMN IF NOT EXISTS start_km numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_km numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_km numeric GENERATED ALWAYS AS (end_km - start_km) STORED;