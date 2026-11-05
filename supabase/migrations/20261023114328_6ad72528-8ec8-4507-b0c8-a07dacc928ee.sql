ALTER TABLE public.ai_pitch_feedback ADD COLUMN IF NOT EXISTS reason text;
CREATE OR REPLACE FUNCTION public.validate_ai_pitch_feedback() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.feedback NOT IN ('like','dislike') THEN RAISE EXCEPTION 'invalid feedback'; END IF;
  IF NEW.reason IS NOT NULL AND length(NEW.reason) > 200 THEN RAISE EXCEPTION 'reason too long'; END IF;
  RETURN NEW;
END $$;