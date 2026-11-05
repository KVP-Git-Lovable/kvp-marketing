ALTER TABLE public.product_schemes DROP CONSTRAINT IF EXISTS valid_scheme_type;
ALTER TABLE public.product_schemes ADD CONSTRAINT valid_scheme_type CHECK (
  scheme_type = ANY (ARRAY[
    'percentage_discount'::text,
    'flat_discount'::text,
    'buy_x_get_y_free'::text,
    'bundle_combo'::text,
    'tiered_discount'::text,
    'time_based_offer'::text,
    'first_order_discount'::text,
    'category_wide_discount'::text,
    'manual_per_unit_discount'::text
  ])
);