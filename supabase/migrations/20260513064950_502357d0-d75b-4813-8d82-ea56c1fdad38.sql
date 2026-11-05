
-- Add support for "Manual Per-Unit Discount" scheme type
-- Admin sets a max per-unit cap; salesperson chooses how much to give (≤ cap) on one cart line.

ALTER TABLE public.product_schemes
  ADD COLUMN IF NOT EXISTS max_discount_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_unit TEXT;

COMMENT ON COLUMN public.product_schemes.max_discount_per_unit IS
  'Upper cap on per-unit discount the salesperson can manually enter at order entry (used by scheme_type = manual_per_unit_discount).';
COMMENT ON COLUMN public.product_schemes.discount_unit IS
  'Display unit label for max_discount_per_unit (e.g. kg, pc, ltr, g).';
