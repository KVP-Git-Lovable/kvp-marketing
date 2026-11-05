-- Update ShravyaShravya's role to admin
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '88ad4236-5776-4306-b583-3b8181b8ca1d';

-- If no row exists, insert one
INSERT INTO public.user_roles (user_id, role) 
VALUES ('88ad4236-5776-4306-b583-3b8181b8ca1d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;