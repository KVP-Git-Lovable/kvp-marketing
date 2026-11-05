-- Keep only the most recently updated row and delete all others
DELETE FROM expense_master_config
WHERE id NOT IN (
  SELECT id FROM expense_master_config
  ORDER BY updated_at DESC
  LIMIT 1
);