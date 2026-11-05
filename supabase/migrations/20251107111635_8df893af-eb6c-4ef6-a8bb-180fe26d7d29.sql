-- Add missing payment_method and payment_proof_url columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;