CREATE TABLE public.ai_pitch_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  retailer_id uuid NOT NULL,
  category text NOT NULL,
  product_id uuid NOT NULL,
  variant_id uuid,
  variant_key text GENERATED ALWAYS AS (COALESCE(variant_id::text, 'base')) STORED,
  suggested_qty numeric,
  unit text,
  feedback text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_pitch_feedback_unique UNIQUE (user_id, retailer_id, product_id, variant_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_pitch_feedback TO authenticated;
GRANT ALL ON public.ai_pitch_feedback TO service_role;
ALTER TABLE public.ai_pitch_feedback ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_ai_pitch_feedback() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.feedback NOT IN ('like','dislike') THEN RAISE EXCEPTION 'invalid feedback'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ai_pitch_feedback_validate BEFORE INSERT OR UPDATE ON public.ai_pitch_feedback FOR EACH ROW EXECUTE FUNCTION public.validate_ai_pitch_feedback();
CREATE TRIGGER ai_pitch_feedback_updated BEFORE UPDATE ON public.ai_pitch_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Own pitch feedback select" ON public.ai_pitch_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid())));
CREATE POLICY "Own pitch feedback insert" ON public.ai_pitch_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own pitch feedback update" ON public.ai_pitch_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own pitch feedback delete" ON public.ai_pitch_feedback FOR DELETE TO authenticated USING (user_id = auth.uid());