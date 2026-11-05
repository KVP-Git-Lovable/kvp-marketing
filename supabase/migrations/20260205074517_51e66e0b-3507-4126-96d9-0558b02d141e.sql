-- Add RLS policy to allow managers to view order items for their subordinates' orders
-- This policy allows users to see order_items for orders that belong to their subordinates

-- First, create a helper function to get all subordinate user IDs
CREATE OR REPLACE FUNCTION get_all_subordinate_ids(manager_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID[];
BEGIN
  WITH RECURSIVE subordinate_tree AS (
    -- Direct reports
    SELECT 
      uh.user_id,
      1 as level
    FROM user_hierarchy uh
    WHERE uh.manager_id = get_all_subordinate_ids.manager_id
    
    UNION ALL
    
    -- Indirect reports (recursive)
    SELECT 
      uh.user_id,
      st.level + 1
    FROM user_hierarchy uh
    INNER JOIN subordinate_tree st ON uh.manager_id = st.user_id
    WHERE st.level < 10
  )
  SELECT ARRAY(SELECT user_id FROM subordinate_tree) INTO result;
  
  RETURN result;
END;
$$;

-- Add RLS policy for managers to view order items of their subordinates
CREATE POLICY "Managers can view order items for subordinate orders"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.user_id = auth.uid()
      OR o.user_id = ANY(get_all_subordinate_ids(auth.uid()))
    )
  )
);

-- Also add a simple policy for authenticated users to view order_items for reporting (matching orders policy)
CREATE POLICY "Authenticated users can view order items for reporting"
ON public.order_items
FOR SELECT
USING (auth.role() = 'authenticated');