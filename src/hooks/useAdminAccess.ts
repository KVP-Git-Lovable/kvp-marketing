import { useAuth } from '@/hooks/useAuth';
import { useProfilePermissions } from '@/hooks/useProfilePermissions';

export const useAdminAccess = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const { hasAnyAdminPermission, hasModuleAccess, permittedAdminPaths, isLoading: permLoading } = useProfilePermissions();
  
  // hasAdminAccess is now purely based on profile_object_permissions
  const hasAdminAccess = hasAnyAdminPermission;
  
  return { 
    hasAdminAccess, 
    hasModuleAccess,
    permittedAdminPaths,
    loading: authLoading || permLoading, 
    user, 
    userRole,
  };
};
