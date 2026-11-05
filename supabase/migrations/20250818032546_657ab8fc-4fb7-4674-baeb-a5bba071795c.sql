-- Fix function search path security issues
DROP FUNCTION IF EXISTS public.create_approval_workflow(UUID);
DROP FUNCTION IF EXISTS public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID);

-- Create approval workflow function with secure search path
CREATE OR REPLACE FUNCTION public.create_approval_workflow(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    approver_rec RECORD;
BEGIN
    -- Insert approval records for each level
    FOR approver_rec IN 
        SELECT user_id as approver_id, approver_level 
        FROM public.approvers 
        WHERE is_active = true 
        ORDER BY approver_level
    LOOP
        INSERT INTO public.user_approvals (user_id, approver_id, approval_level)
        VALUES (user_id_param, approver_rec.approver_id, approver_rec.approver_level);
    END LOOP;
END;
$$;

-- Create notification function with secure search path
CREATE OR REPLACE FUNCTION public.send_notification(
    user_id_param UUID,
    title_param TEXT,
    message_param TEXT,
    type_param TEXT DEFAULT 'info',
    related_table_param TEXT DEFAULT NULL,
    related_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
    VALUES (user_id_param, title_param, message_param, type_param, related_table_param, related_id_param)
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;