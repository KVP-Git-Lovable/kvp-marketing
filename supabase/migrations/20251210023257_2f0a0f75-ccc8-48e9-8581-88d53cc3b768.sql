
-- Create van_stock record for KA19AF3530 with MANVITH's closing stock from yesterday
-- Van KA19AF3530 ID: 68b657e0-24c2-4ebe-9c87-d8c706d807bb
-- MANVITH user ID: d6d364d5-6f19-4da9-bb48-67b04a8065fa

INSERT INTO van_stock (id, van_id, user_id, stock_date, status, start_km, end_km, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '68b657e0-24c2-4ebe-9c87-d8c706d807bb',
  'd6d364d5-6f19-4da9-bb48-67b04a8065fa',
  '2025-12-09',
  'closing_verified',
  14529,
  14600,
  NOW(),
  NOW()
);

-- Insert stock items with left_qty as the previous closing values
INSERT INTO van_stock_items (id, van_stock_id, product_id, product_name, start_qty, ordered_qty, left_qty, unit, returned_qty, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM van_stock WHERE van_id = '68b657e0-24c2-4ebe-9c87-d8c706d807bb' AND stock_date = '2025-12-09' AND user_id = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa' LIMIT 1),
  product_id,
  product_name,
  start_qty,
  ordered_qty,
  left_qty,
  unit,
  returned_qty,
  NOW(),
  NOW()
FROM van_stock_items
WHERE van_stock_id = '17be25cb-cd52-43b6-a497-7fa50dac7e9d';
