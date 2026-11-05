-- Enable realtime for visits table
ALTER TABLE public.visits REPLICA IDENTITY FULL;

-- Add the visits table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;

-- Enable realtime for orders table
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add the orders table to the realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;