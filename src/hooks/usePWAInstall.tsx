import { useState, useEffect, useCallback } from "react";
import { 
  getDeferredPrompt, 
  clearDeferredPrompt, 
  wasPromptCaptured,
  type BeforeInstallPromptEvent 
} from "@/utils/pwaInstallCapture";

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    // Initialize with any already-captured prompt
    getDeferredPrompt()
  );
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissCount, setDismissCount] = useState(() => {
    return parseInt(localStorage.getItem('pwa-dismiss-count') || '0');
  });

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isInstalledApp = isStandalone || isIOSStandalone;
    setIsInstalled(isInstalledApp);

    // Check for already captured prompt from global handler
    const existingPrompt = getDeferredPrompt();
    if (existingPrompt) {
      console.log('📱 Using previously captured install prompt');
      setDeferredPrompt(existingPrompt);
      setIsInstallable(true);
    } else if (!isInstalledApp && dismissCount < 2) {
      // Show install option based on browser support
      const supportsInstall = 'serviceWorker' in navigator;
      setIsInstallable(supportsInstall);
    }

    // Listen for new prompt captures
    const handlePromptReady = () => {
      const prompt = getDeferredPrompt();
      if (prompt) {
        console.log('📱 Install prompt ready from global capture');
        setDeferredPrompt(prompt);
        setIsInstallable(true);
      }
    };

    // Also listen for the original event in case it fires after mount
    const handleBeforeInstall = (e: Event) => {
      console.log('📱 beforeinstallprompt event fired (hook listener)');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const appInstalledHandler = () => {
      console.log('✅ App was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      clearDeferredPrompt();
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', appInstalledHandler);

    // Log current state for debugging
    console.log('📱 PWA Install Hook initialized:', {
      isStandalone,
      isIOSStandalone,
      isInstalled: isInstalledApp,
      hasExistingPrompt: !!existingPrompt,
      wasPromptCaptured: wasPromptCaptured(),
      userAgent: navigator.userAgent.substring(0, 50)
    });

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, [dismissCount]);

  const installApp = useCallback(async (): Promise<{ success: boolean; method: 'native' | 'manual'; platform: string }> => {
    console.log('📱 Install button clicked, deferredPrompt:', !!deferredPrompt);
    
    // Try to use the native prompt first
    const prompt = deferredPrompt || getDeferredPrompt();
    
    if (prompt) {
      try {
        console.log('📱 Triggering native install prompt...');
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        
        console.log('📱 User response to install prompt:', outcome);
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
          clearDeferredPrompt();
          return { success: true, method: 'native', platform: 'chromium' };
        }
        
        setDeferredPrompt(null);
        clearDeferredPrompt();
        setIsInstallable(false);
        return { success: false, method: 'native', platform: 'chromium' };
      } catch (error) {
        console.error('📱 Native install failed:', error);
      }
    }

    // Detect platform for manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    const isSamsungBrowser = /SamsungBrowser/.test(navigator.userAgent);
    
    let platform = 'desktop';
    if (isIOS) platform = 'ios';
    else if (isAndroid) platform = 'android';
    
    // Return info about what manual method is needed
    return { success: false, method: 'manual', platform };
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    const newCount = dismissCount + 1;
    setDismissCount(newCount);
    localStorage.setItem('pwa-dismiss-count', newCount.toString());
    setIsInstallable(false);
  }, [dismissCount]);

  const getPlatformInfo = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    const isSamsungBrowser = /SamsungBrowser/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    
    return {
      isIOS,
      isAndroid,
      isChrome,
      isSamsungBrowser,
      isFirefox,
      isMobile: isIOS || isAndroid
    };
  }, []);

  return {
    isInstallable: isInstallable && !isInstalled && dismissCount < 2,
    isInstalled,
    installApp,
    canPrompt: !!(deferredPrompt || getDeferredPrompt()),
    handleDismiss,
    getPlatformInfo
  };
};