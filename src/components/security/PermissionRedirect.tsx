import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

interface PermissionRedirectProps {
  moduleName?: string;
  redirectTo?: string;
}

/**
 * Replaces raw <Navigate> for permission-denied redirects.
 * Shows a toast warning pointing the user to Security & Access Control.
 */
export const PermissionRedirect = ({ 
  moduleName, 
  redirectTo = '/dashboard' 
}: PermissionRedirectProps) => {
  useEffect(() => {
    const message = moduleName
      ? `"${moduleName}" requires access. Enable it from Security & Access Control for your profile.`
      : 'This module requires access. Enable it from Security & Access Control for your profile.';
    
    toast.warning('Access Restricted', {
      description: message,
      duration: 5000,
    });
  }, [moduleName]);

  return <Navigate to={redirectTo} replace />;
};
