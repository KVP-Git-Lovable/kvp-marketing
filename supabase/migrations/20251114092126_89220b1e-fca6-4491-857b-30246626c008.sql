-- Add feature flag for payment proof mandatory
INSERT INTO feature_flags (
  feature_key,
  feature_name,
  description,
  category,
  is_enabled
) VALUES (
  'payment_proof_mandatory',
  'Payment Proof Mandatory',
  'When enabled, users must capture payment proof (cheque/UPI/NEFT photo) before submitting orders. When disabled, payment proof is optional.',
  'Order Management',
  true
)
ON CONFLICT (feature_key) DO NOTHING;