ALTER TABLE public.product_schemes
ADD COLUMN IF NOT EXISTS discount_value_type TEXT DEFAULT 'amount';

COMMENT ON COLUMN public.product_schemes.discount_value_type IS 'For manual_per_unit_discount: amount (₹/unit) or percentage (% off rate per unit)';