UPDATE public.retailers r
SET owner_id = b.created_by
FROM public.beats b
WHERE r.beat_id = b.beat_id
  AND r.owner_id IS NULL
  AND b.created_by IS NOT NULL;