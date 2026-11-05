-- Add new columns for joint sales feedback
ALTER TABLE public.joint_sales_feedback
ADD COLUMN IF NOT EXISTS product_packaging_feedback TEXT,
ADD COLUMN IF NOT EXISTS product_sku_range_feedback TEXT,
ADD COLUMN IF NOT EXISTS promotion_vs_competition TEXT,
ADD COLUMN IF NOT EXISTS product_usp_feedback TEXT,
ADD COLUMN IF NOT EXISTS willingness_to_grow_range TEXT,
ADD COLUMN IF NOT EXISTS monthly_potential_6months NUMERIC DEFAULT 0;

-- Update RLS policy for FSE insert - ensure FSEs can insert their own feedback
DROP POLICY IF EXISTS "joint_sales_feedback_insert_own" ON public.joint_sales_feedback;
CREATE POLICY "FSE can insert own feedback" 
ON public.joint_sales_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = fse_user_id);