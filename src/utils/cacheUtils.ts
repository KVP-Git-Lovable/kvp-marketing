// Cache management utilities

export const clearAllCaches = async (): Promise<void> => {
  try {
    // Clear all cache storage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared successfully');
    }

    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Unregister service worker to force refresh
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister())
      );
      console.log('Service workers unregistered');
    }
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

export const clearApiCache = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      // Delete ALL cache versions including v3
      const allCaches = await caches.keys();
      const apiCaches = allCaches.filter(name => 
        name.includes('api-cache') || 
        name.includes('images-cache') || 
        name.includes('dynamic-cache') ||
        name.includes('workbox')
      );
      await Promise.all(apiCaches.map(name => caches.delete(name)));
      console.log('✅ All runtime caches cleared:', apiCaches);
    }
  } catch (error) {
    console.error('Error clearing API cache:', error);
  }
};

export const forceRefresh = (): void => {
  // Try to activate the waiting service worker, then reload
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        const onControllerChange = () => {
          window.location.reload();
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        // Safety reload in case controllerchange doesn't fire
        setTimeout(() => window.location.reload(), 3000);
      } else {
        window.location.reload();
      }
    });
  } else {
    window.location.reload();
  }
};

// Check if app needs update
export const checkForUpdates = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      return registration.waiting !== null;
    }
  }
  return false;
};