-- Add selling_price column to competition_data table
ALTER TABLE competition_data 
ADD COLUMN IF NOT EXISTS selling_price NUMERIC;

-- Rename impact_level to retailer_feedback for clarity
-- Note: We'll keep the column name as impact_level in DB but change the UI labels and values