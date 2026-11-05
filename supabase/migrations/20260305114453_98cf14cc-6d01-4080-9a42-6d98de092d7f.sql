
-- Table for external retailer database
CREATE TABLE public.retailer_external_db (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name text NOT NULL,
  address text,
  city text NOT NULL,
  pincode text,
  state text NOT NULL,
  mobile text,
  email text,
  website text,
  category text
);

-- Indexes for fast lookup
CREATE INDEX idx_retailer_ext_state ON public.retailer_external_db (state);
CREATE INDEX idx_retailer_ext_state_city ON public.retailer_external_db (state, city);

-- RLS
ALTER TABLE public.retailer_external_db ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read retailer_external_db"
  ON public.retailer_external_db FOR SELECT TO authenticated USING (true);

-- Grant permissions
GRANT SELECT ON public.retailer_external_db TO authenticated;
GRANT SELECT ON public.retailer_external_db TO anon;

-- Function to get distinct states
CREATE OR REPLACE FUNCTION public.get_retailer_ext_states()
RETURNS TABLE(state text)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT r.state
  FROM public.retailer_external_db r
  WHERE r.state IS NOT NULL
  ORDER BY r.state;
$$;

-- Function to get distinct cities for a state
CREATE OR REPLACE FUNCTION public.get_retailer_ext_cities(selected_state text)
RETURNS TABLE(city text)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT r.city
  FROM public.retailer_external_db r
  WHERE r.state = selected_state
    AND r.city IS NOT NULL
  ORDER BY r.city;
$$;
