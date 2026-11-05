-- Fix entity_id column to support text values (beat_id, retailer_id)
ALTER TABLE public.recommendations 
ALTER COLUMN entity_id TYPE text USING entity_id::text;