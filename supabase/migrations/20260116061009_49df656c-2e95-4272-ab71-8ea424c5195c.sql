-- Add 'inactive' to the user_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'inactive' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_status')
    ) THEN
        ALTER TYPE public.user_status ADD VALUE 'inactive';
    END IF;
END$$;