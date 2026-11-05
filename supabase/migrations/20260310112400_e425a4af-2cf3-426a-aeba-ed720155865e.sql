
-- RPC: get distinct states from retailer_external_unsorted
CREATE OR REPLACE FUNCTION public.get_retailer_unsorted_states()
RETURNS TABLE(state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT "State" AS state
  FROM public.retailer_external_unsorted
  WHERE "State" IS NOT NULL AND trim("State") != ''
  ORDER BY "State";
$$;

-- RPC: get distinct districts for a given state
CREATE OR REPLACE FUNCTION public.get_retailer_unsorted_districts(selected_state text)
RETURNS TABLE(district text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT "District" AS district
  FROM public.retailer_external_unsorted
  WHERE "State" = selected_state
    AND "District" IS NOT NULL AND trim("District") != ''
  ORDER BY "District";
$$;

-- RPC: get distinct cities for a given state and district
CREATE OR REPLACE FUNCTION public.get_retailer_unsorted_cities(selected_state text, selected_district text)
RETURNS TABLE(city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT "City" AS city
  FROM public.retailer_external_unsorted
  WHERE "State" = selected_state
    AND "District" = selected_district
    AND "City" IS NOT NULL AND trim("City") != ''
  ORDER BY "City";
$$;
