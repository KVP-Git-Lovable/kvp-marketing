-- Expand latitude/longitude precision to handle all coordinate formats
ALTER TABLE public.pincode_master 
  ALTER COLUMN latitude TYPE DOUBLE PRECISION,
  ALTER COLUMN longitude TYPE DOUBLE PRECISION;