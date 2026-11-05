-- Remove admin-only restriction and allow users to manage their own beat allowances
DROP POLICY IF EXISTS "Admins can manage beat allowances" ON public.beat_allowances;

-- Create new policies for users to manage their own beat allowances
CREATE POLICY "Users can create their own beat allowances" 
ON public.beat_allowances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beat allowances" 
ON public.beat_allowances 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beat allowances" 
ON public.beat_allowances 
FOR DELETE 
USING (auth.uid() = user_id);