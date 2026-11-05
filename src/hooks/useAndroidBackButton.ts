import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to handle Android hardware back button in Capacitor apps
 * Provides proper navigation history handling for APK builds
 */
export const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only set up back button handler on native Android platform
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    let cleanupFn: (() => void) | undefined;

    const setupListener = async () => {
      const backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // Define routes that should exit the app instead of navigating back
        const exitRoutes = ['/', '/dashboard', '/auth'];
        
        if (exitRoutes.includes(location.pathname)) {
          // On main screens, exit the app
          CapacitorApp.exitApp();
        } else if (canGoBack) {
          // Navigate back in history
          navigate(-1);
        } else {
          // No history to go back to, go to dashboard
          navigate('/dashboard');
        }
      });

      cleanupFn = () => backButtonListener.remove();
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [navigate, location]);
};
