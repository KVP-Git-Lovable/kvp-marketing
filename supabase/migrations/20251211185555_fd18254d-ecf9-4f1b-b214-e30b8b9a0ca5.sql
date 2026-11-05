-- =============================================
-- DISTRIBUTOR CLAIMS & EXPENSES TABLE
-- =============================================
CREATE TABLE public.distributor_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id),
  created_by_user_id UUID,
  
  -- Claim Details
  claim_type TEXT NOT NULL, -- expense, damage_return, scheme_claim, credit_note
  claim_number TEXT NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Financial Details
  claim_amount NUMERIC NOT NULL DEFAULT 0,
  approved_amount NUMERIC DEFAULT 0,
  
  -- Reference Details (link to order, invoice, etc.)
  reference_type TEXT, -- order, invoice, delivery
  reference_number TEXT,
  reference_id UUID,
  
  -- Expense Specific Fields
  expense_category TEXT, -- transportation, marketing, promotional, logistics
  expense_date DATE,
  vehicle_number TEXT,
  km_traveled NUMERIC,
  
  -- Damage/Return Specific Fields
  damage_reason TEXT,
  product_details JSONB DEFAULT '[]'::jsonb, -- [{product_name, quantity, unit, reason}]
  
  -- Scheme Claim Specific Fields
  scheme_name TEXT,
  scheme_period TEXT,
  target_achieved NUMERIC,
  
  -- Documentation
  bill_urls TEXT[] DEFAULT '{}',
  supporting_docs TEXT[] DEFAULT '{}',
  description TEXT,
  
  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'pending', -- pending, under_review, approved, rejected, paid
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for claim numbers
CREATE SEQUENCE IF NOT EXISTS distributor_claim_seq START 1;

-- Auto-generate claim number
CREATE OR REPLACE FUNCTION generate_distributor_claim_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claim_number IS NULL OR NEW.claim_number = '' THEN
    NEW.claim_number := 'CLM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD(NEXTVAL('distributor_claim_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_claim_number
BEFORE INSERT ON public.distributor_claims
FOR EACH ROW EXECUTE FUNCTION generate_distributor_claim_number();

-- Enable RLS
ALTER TABLE public.distributor_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Distributors can view their own claims"
ON public.distributor_claims FOR SELECT
USING (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Distributors can create their own claims"
ON public.distributor_claims FOR INSERT
WITH CHECK (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all claims"
ON public.distributor_claims FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- DISTRIBUTOR SUPPORT REQUESTS TABLE
-- =============================================
CREATE TABLE public.distributor_support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id),
  created_by_user_id UUID,
  
  -- Request Details
  ticket_number TEXT NOT NULL,
  category TEXT NOT NULL, -- order_issue, payment_invoice, product_quality, delivery, portal_technical
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  
  -- Issue Details
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Reference (optional)
  reference_type TEXT, -- order, invoice, product, delivery
  reference_id UUID,
  reference_number TEXT,
  
  -- Attachments
  attachment_urls TEXT[] DEFAULT '{}',
  screenshot_urls TEXT[] DEFAULT '{}',
  
  -- Status & Resolution
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, waiting_on_customer, resolved, closed
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  
  -- Resolution
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  
  -- Feedback
  satisfaction_rating INTEGER, -- 1-5
  feedback_comment TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS distributor_support_seq START 1;

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION generate_support_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                         LPAD(NEXTVAL('distributor_support_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_support_ticket_number
BEFORE INSERT ON public.distributor_support_requests
FOR EACH ROW EXECUTE FUNCTION generate_support_ticket_number();

-- Enable RLS
ALTER TABLE public.distributor_support_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Distributors can view their own support requests"
ON public.distributor_support_requests FOR SELECT
USING (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Distributors can create their own support requests"
ON public.distributor_support_requests FOR INSERT
WITH CHECK (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Distributors can update their own support requests"
ON public.distributor_support_requests FOR UPDATE
USING (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all support requests"
ON public.distributor_support_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- DISTRIBUTOR IDEAS TABLE
-- =============================================
CREATE TABLE public.distributor_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id),
  created_by_user_id UUID,
  
  -- Idea Details
  idea_number TEXT NOT NULL,
  category TEXT NOT NULL, -- market_feedback, product_suggestion, process_improvement, new_opportunity
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Business Impact
  expected_impact TEXT, -- low, medium, high
  estimated_value NUMERIC, -- potential revenue/savings
  implementation_effort TEXT, -- low, medium, high
  
  -- Market/Region Context
  region TEXT,
  market_segment TEXT,
  target_audience TEXT,
  
  -- Competition Related
  competitor_name TEXT,
  competitor_insight TEXT,
  
  -- Product Suggestions
  suggested_product TEXT,
  suggested_packaging TEXT,
  suggested_price_range TEXT,
  
  -- Attachments
  attachment_urls TEXT[] DEFAULT '{}',
  
  -- Status & Review
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted, under_review, accepted, implemented, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Implementation (if accepted)
  implementation_status TEXT, -- planned, in_progress, completed
  implementation_date DATE,
  
  -- Recognition
  points_awarded INTEGER DEFAULT 0,
  recognition_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for idea numbers
CREATE SEQUENCE IF NOT EXISTS distributor_idea_seq START 1;

-- Auto-generate idea number
CREATE OR REPLACE FUNCTION generate_idea_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.idea_number IS NULL OR NEW.idea_number = '' THEN
    NEW.idea_number := 'IDEA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(NEXTVAL('distributor_idea_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_idea_number
BEFORE INSERT ON public.distributor_ideas
FOR EACH ROW EXECUTE FUNCTION generate_idea_number();

-- Enable RLS
ALTER TABLE public.distributor_ideas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Distributors can view their own ideas"
ON public.distributor_ideas FOR SELECT
USING (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Distributors can create their own ideas"
ON public.distributor_ideas FOR INSERT
WITH CHECK (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Distributors can update their own ideas"
ON public.distributor_ideas FOR UPDATE
USING (
  distributor_id IN (
    SELECT distributor_id FROM public.distributor_users 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all ideas"
ON public.distributor_ideas FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_distributor_claims_distributor ON public.distributor_claims(distributor_id);
CREATE INDEX idx_distributor_claims_status ON public.distributor_claims(status);
CREATE INDEX idx_distributor_claims_type ON public.distributor_claims(claim_type);

CREATE INDEX idx_distributor_support_distributor ON public.distributor_support_requests(distributor_id);
CREATE INDEX idx_distributor_support_status ON public.distributor_support_requests(status);
CREATE INDEX idx_distributor_support_priority ON public.distributor_support_requests(priority);

CREATE INDEX idx_distributor_ideas_distributor ON public.distributor_ideas(distributor_id);
CREATE INDEX idx_distributor_ideas_status ON public.distributor_ideas(status);
CREATE INDEX idx_distributor_ideas_category ON public.distributor_ideas(category);