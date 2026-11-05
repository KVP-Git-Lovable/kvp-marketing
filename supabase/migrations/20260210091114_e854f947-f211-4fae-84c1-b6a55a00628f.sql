ALTER TABLE public.fy_target_config
ADD COLUMN target_start_month integer NOT NULL DEFAULT 1,
ADD COLUMN target_end_month integer NOT NULL DEFAULT 12;