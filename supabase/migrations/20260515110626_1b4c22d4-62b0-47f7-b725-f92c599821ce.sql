UPDATE public.order_items
SET order_id = '80f0b50c-ba57-4641-b878-4c98d0c44abc'
WHERE id IN (
  '93f9b7d2-ca74-49e0-9e8d-98cc60d8cf06',
  'f6f27527-c86d-4013-8634-bd1bb0438058'
)
AND order_id IS NULL;