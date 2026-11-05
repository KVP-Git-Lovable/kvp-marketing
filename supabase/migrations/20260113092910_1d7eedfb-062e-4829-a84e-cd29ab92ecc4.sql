-- Alter recycle_bin.original_id from UUID to TEXT to support non-UUID IDs (like beat IDs)
ALTER TABLE public.recycle_bin 
ALTER COLUMN original_id TYPE TEXT USING original_id::TEXT;

-- Alter permanent_deletion_log.original_id from UUID to TEXT
ALTER TABLE public.permanent_deletion_log 
ALTER COLUMN original_id TYPE TEXT USING original_id::TEXT;