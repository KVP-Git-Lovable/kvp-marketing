-- Assign ShravyaShravya to the same tenant as their manager
UPDATE public.profiles 
SET tenant_id = '24f9138a-6390-44e6-901d-701d0d75702e' 
WHERE id = '88ad4236-5776-4306-b583-3b8181b8ca1d';

INSERT INTO public.tenant_users (tenant_id, user_id, role)
VALUES ('24f9138a-6390-44e6-901d-701d0d75702e', '88ad4236-5776-4306-b583-3b8181b8ca1d', 'admin')
ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;