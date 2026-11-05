-- Hash existing unhashed hint answers
UPDATE public.profiles 
SET hint_answer = public.hash_hint_answer(hint_answer)
WHERE hint_answer IS NOT NULL 
  AND hint_answer NOT LIKE 'hash:%'; -- Don't re-hash already hashed values

-- Create trigger to automatically hash hint answers on insert/update
CREATE OR REPLACE FUNCTION public.hash_hint_answer_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only hash if hint_answer is provided and not already hashed
  IF NEW.hint_answer IS NOT NULL AND NEW.hint_answer NOT LIKE 'hash:%' THEN
    NEW.hint_answer := public.hash_hint_answer(NEW.hint_answer);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-hash hint answers
DROP TRIGGER IF EXISTS hash_hint_answer_on_change ON public.profiles;
CREATE TRIGGER hash_hint_answer_on_change
  BEFORE INSERT OR UPDATE OF hint_answer ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_hint_answer_trigger();