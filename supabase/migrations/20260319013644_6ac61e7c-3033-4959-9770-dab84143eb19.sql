
CREATE OR REPLACE FUNCTION public.nextval_text(seq_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval(seq_name)::text;
$$;
