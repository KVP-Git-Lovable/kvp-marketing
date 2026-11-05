-- Fix the date for existing beat allowances that were created for August 19th but stored with August 18th date
UPDATE beat_allowances 
SET created_at = '2025-08-19T12:00:00.000Z' 
WHERE user_id = 'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd' 
  AND created_at::date = '2025-08-18'
  AND beat_name IN ('Kavoor', 'Bejai', 'Bellendur Beat', 'Lalbhag');

-- Insert missing beat plan for Lalbhag if it doesn't exist
INSERT INTO beat_plans (user_id, plan_date, beat_id, beat_name, beat_data)
SELECT 
  'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd',
  '2025-08-19',
  'beat_1754914848499_5qqzcmky4',
  'Lalbhag',
  '{"id": "beat_1754914848499_5qqzcmky4", "name": "Lalbhag", "category": "all", "priority": "medium", "retailerCount": 0}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM beat_plans 
  WHERE user_id = 'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd' 
    AND plan_date = '2025-08-19' 
    AND beat_id = 'beat_1754914848499_5qqzcmky4'
);