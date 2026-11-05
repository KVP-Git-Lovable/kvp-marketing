-- Add missing columns to competition_insights table
ALTER TABLE public.competition_insights
ADD COLUMN IF NOT EXISTS competitor_image_url TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS product_details TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS price_info TEXT,
ADD COLUMN IF NOT EXISTS shelf_space TEXT,
ADD COLUMN IF NOT EXISTS location_info TEXT,
ADD COLUMN IF NOT EXISTS additional_notes TEXT;