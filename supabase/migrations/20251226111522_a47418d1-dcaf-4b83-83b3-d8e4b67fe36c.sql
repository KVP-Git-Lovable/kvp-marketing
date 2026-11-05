-- Add target_config column to retailer_loyalty_actions
ALTER TABLE retailer_loyalty_actions 
ADD COLUMN IF NOT EXISTS target_config JSONB DEFAULT '{}';

-- Create retailer_loyalty_rewards table (Goodies/Rewards catalog)
CREATE TABLE public.retailer_loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES retailer_loyalty_programs(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('gift', 'holiday', 'cash_conversion', 'voucher')),
  reward_name TEXT NOT NULL,
  description TEXT,
  points_required NUMERIC NOT NULL CHECK (points_required > 0),
  cash_value NUMERIC,
  image_url TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on rewards table
ALTER TABLE public.retailer_loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for rewards
CREATE POLICY "Admins can manage rewards" 
ON public.retailer_loyalty_rewards 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view rewards" 
ON public.retailer_loyalty_rewards 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create retailer_loyalty_reward_redemptions table
CREATE TABLE public.retailer_loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES retailer_loyalty_rewards(id),
  retailer_id UUID NOT NULL REFERENCES retailers(id),
  program_id UUID NOT NULL REFERENCES retailer_loyalty_programs(id),
  points_redeemed NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dispatched', 'delivered', 'rejected')),
  delivery_address TEXT,
  delivery_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  tracking_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on reward redemptions table
ALTER TABLE public.retailer_loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for reward redemptions
CREATE POLICY "Admins can manage reward redemptions" 
ON public.retailer_loyalty_reward_redemptions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view reward redemptions" 
ON public.retailer_loyalty_reward_redemptions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_loyalty_rewards_program ON retailer_loyalty_rewards(program_id);
CREATE INDEX idx_loyalty_rewards_active ON retailer_loyalty_rewards(is_active);
CREATE INDEX idx_reward_redemptions_retailer ON retailer_loyalty_reward_redemptions(retailer_id);
CREATE INDEX idx_reward_redemptions_status ON retailer_loyalty_reward_redemptions(status);

-- Trigger for updated_at on rewards
CREATE TRIGGER update_retailer_loyalty_rewards_updated_at
BEFORE UPDATE ON retailer_loyalty_rewards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on redemptions
CREATE TRIGGER update_retailer_loyalty_reward_redemptions_updated_at
BEFORE UPDATE ON retailer_loyalty_reward_redemptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();