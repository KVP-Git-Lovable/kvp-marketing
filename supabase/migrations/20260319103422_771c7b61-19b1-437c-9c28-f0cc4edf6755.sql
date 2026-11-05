-- Fix NULL confirmation_token values in auth.users that cause
-- "sql: Scan error on column index 3, name confirmation_token: converting NULL to string is unsupported"
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;

UPDATE auth.users 
SET email_change_token_new = '' 
WHERE email_change_token_new IS NULL;

UPDATE auth.users 
SET email_change_token_current = '' 
WHERE email_change_token_current IS NULL;