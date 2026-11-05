
-- Clean up orphaned retailer_visit_logs for the already-deleted testuser
DELETE FROM public.retailer_visit_logs WHERE user_id = '4ec01968-6f21-4d68-8fad-f06a04207d26';
