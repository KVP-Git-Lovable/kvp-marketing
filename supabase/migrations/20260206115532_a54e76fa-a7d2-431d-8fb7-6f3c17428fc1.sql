-- Clean up the orphaned joint_sales_feedback row blocking deletion of user a59f958b
DELETE FROM public.joint_sales_feedback WHERE manager_id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';

-- Also check and clean any remaining profile/employee records for this user
DELETE FROM public.employees WHERE user_id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';
DELETE FROM public.user_roles WHERE user_id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';
DELETE FROM public.user_profiles WHERE user_id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';
DELETE FROM public.user_object_permissions WHERE user_id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';
DELETE FROM public.profiles WHERE id = 'a59f958b-d6d6-404d-b7a3-6616587eacc0';