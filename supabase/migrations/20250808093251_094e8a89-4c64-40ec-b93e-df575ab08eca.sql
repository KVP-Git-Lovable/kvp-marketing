-- Make Prajwal an admin user
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE username ILIKE '%prajwal%' OR username ILIKE '%pra%'
  LIMIT 1
);

-- If no existing role record, insert one
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE (p.username ILIKE '%prajwal%' OR p.username ILIKE '%pra%')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
LIMIT 1;