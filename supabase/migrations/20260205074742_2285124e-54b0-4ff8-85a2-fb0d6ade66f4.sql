-- Drop the problematic policies and function that reference non-existent user_hierarchy table
DROP POLICY IF EXISTS "Managers can view order items for subordinate orders" ON public.order_items;
DROP FUNCTION IF EXISTS get_all_subordinate_ids(UUID);

-- Keep only the simple policy that allows authenticated users to view order_items for reporting
-- This matches the existing orders policy that already works