-- Fix duplicate orders and wrong product_id for ADUKU 500G

-- Step 1: Delete one of the duplicate orders (keep 66da3d8a-97d8-47d2-bd9c-ffab02019f70)
DELETE FROM order_items WHERE order_id = '063218dc-59fc-427d-be0a-2486b74f58c5';
DELETE FROM orders WHERE id = '063218dc-59fc-427d-be0a-2486b74f58c5';

-- Step 2: Update the remaining order items for ADUKU 500G to use correct variant product_id
UPDATE order_items 
SET product_id = 'c5095167-b553-4aa7-b74e-493b9164c58a'  -- ADUKU 500G variant UUID
WHERE product_name = 'ADUKU 500G' 
AND product_id = '7f9e8802-1a63-4fbf-afa2-096210e82745';  -- Wrong base product UUID

-- Step 3: Also fix any ADUKU 250G orders that might have the wrong product_id
UPDATE order_items 
SET product_id = '0bc4a82f-4ef1-4ae6-b8af-a413470a3fdf'  -- ADUKU 250G variant UUID
WHERE product_name = 'ADUKU 250G' 
AND product_id = '7f9e8802-1a63-4fbf-afa2-096210e82745';  -- Wrong base product UUID