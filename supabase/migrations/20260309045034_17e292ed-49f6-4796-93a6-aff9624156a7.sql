
ALTER TABLE public.retailer_visit_logs DROP CONSTRAINT retailer_visit_logs_action_type_check;

ALTER TABLE public.retailer_visit_logs ADD CONSTRAINT retailer_visit_logs_action_type_check 
  CHECK (action_type = ANY (ARRAY[
    'order'::text, 
    'feedback'::text, 
    'ai'::text, 
    'phone_order'::text,
    'order_submitted'::text,
    'checkout'::text,
    'no_order'::text,
    'analytics'::text,
    'view_stock'::text,
    'collection_tips'::text,
    'payment'::text,
    'view_order'::text,
    'check_in'::text
  ]));
