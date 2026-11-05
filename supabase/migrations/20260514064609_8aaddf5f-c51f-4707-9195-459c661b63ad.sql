ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

-- Backfill: link each variant to its base product by brand keyword
UPDATE public.product_variants v
SET product_id = p.id
FROM public.products p
WHERE v.product_id IS NULL AND (
  (upper(v.variant_name) LIKE 'ADUKU%'   AND p.name = 'ADUKU 20G') OR
  (upper(v.variant_name) LIKE 'BLUE%'    AND p.name = 'BLUE 20G') OR
  (upper(v.variant_name) LIKE 'GOLD%'    AND p.name = 'GOLD 40G') OR
  (upper(v.variant_name) LIKE 'YELLOW%'  AND p.name = 'YELLOW 20G') OR
  (upper(v.variant_name) LIKE 'RL JAR%'  AND p.name = 'RL JAR 250') OR
  (upper(v.variant_name) LIKE 'DAKSHIN%' AND p.name = 'DAKSHIN 30G') OR
  (upper(v.variant_name) LIKE 'VAYU%'    AND p.name = 'VAYU 30G') OR
  (upper(v.variant_name) LIKE 'ELACHI%'  AND p.name = 'ELAICHI 40G') OR
  (upper(v.variant_name) LIKE 'ADARAK%'  AND p.name = 'ADRAK 40G')
);