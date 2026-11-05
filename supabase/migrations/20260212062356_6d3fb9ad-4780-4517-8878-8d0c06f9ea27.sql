-- Drop the unique constraint on invoice_number to allow duplicate invoice numbers
-- This prevents order creation from being blocked by sequence collisions
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_number_unique;