-- Create approval workflow tables and enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.user_status AS ENUM ('pending_completion', 'pending_approval', 'approved', 'rejected', 'active');

-- Create approvers table for managing approval hierarchy
CREATE TABLE public.approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_level INTEGER NOT NULL CHECK (approver_level BETWEEN 1 AND 3),
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user approval workflow table
CREATE TABLE public.user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES auth.users(id),
  approval_level INTEGER NOT NULL CHECK (approval_level BETWEEN 1 AND 3),
  status approval_status DEFAULT 'pending',
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  related_table TEXT,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user invitations table for email workflow
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  manager_id UUID REFERENCES auth.users(id),
  invitation_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add user_status column to profiles table
ALTER TABLE public.profiles ADD COLUMN user_status user_status DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN invitation_token TEXT;

-- Enable RLS
ALTER TABLE public.approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approvers
CREATE POLICY "Admins can manage approvers" ON public.approvers
FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view approvers" ON public.approvers
FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for user_approvals
CREATE POLICY "Users can view their own approvals" ON public.user_approvals
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = approver_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Approvers can update their approvals" ON public.user_approvals
FOR UPDATE USING (auth.uid() = approver_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "System can create approvals" ON public.user_approvals
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- RLS Policies for user_invitations
CREATE POLICY "Admins can manage invitations" ON public.user_invitations
FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view invitations by token" ON public.user_invitations
FOR SELECT USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_approvers_updated_at
  BEFORE UPDATE ON public.approvers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_approvals_updated_at
  BEFORE UPDATE ON public.user_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create approval workflow
CREATE OR REPLACE FUNCTION public.create_approval_workflow(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to send notifications
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