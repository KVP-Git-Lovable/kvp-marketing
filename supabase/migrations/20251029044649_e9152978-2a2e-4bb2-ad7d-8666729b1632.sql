-- Create branding_request_items table for asset line items
CREATE TABLE IF NOT EXISTS public.branding_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branding_request_id UUID REFERENCES public.branding_requests(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  due_date DATE,
  preferred_vendor TEXT,
  vendor_confirmation_status TEXT DEFAULT 'Pending',
  vendor_budget NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branding_request_items ENABLE ROW LEVEL SECURITY;

-- Create policies for branding_request_items
CREATE POLICY "Users can view their own branding request items"
ON public.branding_request_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.branding_requests br
    WHERE br.id = branding_request_items.branding_request_id
    AND (
      br.user_id = auth.uid()
      OR br.manager_id = auth.uid()
      OR br.procurement_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Users can create branding request items for their requests"
ON public.branding_request_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.branding_requests br
    WHERE br.id = branding_request_items.branding_request_id
    AND br.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own branding request items"
ON public.branding_request_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.branding_requests br
    WHERE br.id = branding_request_items.branding_request_id
    AND (
      br.user_id = auth.uid()
      OR br.manager_id = auth.uid()
      OR br.procurement_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Users can delete their own branding request items"
ON public.branding_request_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.branding_requests br
    WHERE br.id = branding_request_items.branding_request_id
    AND br.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_branding_request_items_updated_at
BEFORE UPDATE ON public.branding_request_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();