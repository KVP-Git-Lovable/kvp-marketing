-- Create additional_expenses table
CREATE TABLE public.additional_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  custom_category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  bill_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.additional_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own additional expenses" 
ON public.additional_expenses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own additional expenses" 
ON public.additional_expenses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own additional expenses" 
ON public.additional_expenses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own additional expenses" 
ON public.additional_expenses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_additional_expenses_updated_at
BEFORE UPDATE ON public.additional_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();