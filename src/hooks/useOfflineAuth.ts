import { useState, useEffect } from 'react';

/**
 * Hook to check if user is authenticated with offline support
 * Returns cached auth state when offline
 */
export const useOfflineAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check localStorage for cached user
        const cachedUser = localStorage.getItem('cached_user');
        const cachedUserId = localStorage.getItem('cached_user_id');
        
        if (cachedUser) {
          const user = JSON.parse(cachedUser);
          setIsAuthenticated(true);
          setUserId(cachedUserId || user.id);
        } else {
          setIsAuthenticated(false);
          setUserId(null);
        }
      } catch (error) {
        console.error('Error checking offline auth:', error);
        setIsAuthenticated(false);
        setUserId(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cached_user' || e.key === 'cached_user_id') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { isAuthenticated, userId, loading };
};
