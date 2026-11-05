-- Add missing columns to joint_sales_feedback table for enhanced feedback
ALTER TABLE public.joint_sales_feedback
  ADD COLUMN IF NOT EXISTS retailing_feedback TEXT,
  ADD COLUMN IF NOT EXISTS placement_feedback TEXT,
  ADD COLUMN IF NOT EXISTS sales_increase_feedback TEXT,
  ADD COLUMN IF NOT EXISTS new_products_introduced TEXT,
  ADD COLUMN IF NOT EXISTS competition_knowledge TEXT,
  ADD COLUMN IF NOT EXISTS trends_feedback TEXT,
  ADD COLUMN IF NOT EXISTS product_quality_feedback TEXT,
  ADD COLUMN IF NOT EXISTS service_feedback TEXT,
  ADD COLUMN IF NOT EXISTS schemes_feedback TEXT,
  ADD COLUMN IF NOT EXISTS pricing_feedback TEXT,
  ADD COLUMN IF NOT EXISTS consumer_feedback TEXT,
  ADD COLUMN IF NOT EXISTS joint_sales_impact TEXT,
  ADD COLUMN IF NOT EXISTS order_increase_amount DECIMAL(10,2) DEFAULT 0;

-- Add RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'joint_sales_feedback' AND policyname = 'joint_sales_feedback_select_own') THEN
    CREATE POLICY "joint_sales_feedback_select_own"
      ON public.joint_sales_feedback FOR SELECT
      TO authenticated
      USING (manager_id = auth.uid() OR fse_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'joint_sales_feedback' AND policyname = 'joint_sales_feedback_insert_own') THEN
    CREATE POLICY "joint_sales_feedback_insert_own"
      ON public.joint_sales_feedback FOR INSERT
      TO authenticated
      WITH CHECK (manager_id = auth.uid() OR fse_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'joint_sales_feedback' AND policyname = 'joint_sales_feedback_update_own') THEN
    CREATE POLICY "joint_sales_feedback_update_own"
      ON public.joint_sales_feedback FOR UPDATE
      TO authenticated
      USING (manager_id = auth.uid() OR fse_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'joint_sales_feedback' AND policyname = 'joint_sales_feedback_select_admin') THEN
    CREATE POLICY "joint_sales_feedback_select_admin"
      ON public.joint_sales_feedback FOR SELECT
      TO authenticated
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;