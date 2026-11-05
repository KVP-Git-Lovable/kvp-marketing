/**
 * Force a complete cache clear and hard refresh
 * Use this when facing persistent caching issues
 */
export const forceCompleteRefresh = async () => {
  try {
    console.log('🔄 Forcing complete cache clear and refresh...');
    
    // 1. Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    console.log('✅ Service workers unregistered');
    
    // 2. Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('✅ Caches cleared');
    
    // 3. Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Storage cleared');
    
    // 4. Clear IndexedDB
    if (window.indexedDB) {
      const dbs = await window.indexedDB.databases?.();
      if (dbs) {
        await Promise.all(dbs.map(db => {
          if (db.name) {
            return new Promise((resolve) => {
              const request = window.indexedDB.deleteDatabase(db.name!);
              request.onsuccess = () => resolve(true);
              request.onerror = () => resolve(false);
            });
          }
          return Promise.resolve();
        }));
      }
    }
    console.log('✅ IndexedDB cleared');
    
    // 5. Add cache-busting parameter and force reload
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.href = url.toString();
  } catch (error) {
    console.error('Error during force refresh:', error);
    // Fallback: reload with cache-busting parameter
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.href = url.toString();
  }
};

/**
 * Check if a force refresh is needed based on error patterns
 */
export const shouldForceRefresh = (error: Error): boolean => {
  const cacheRelatedErrors = [
    'Cannot read properties of null',
    'useState',
    'Invalid hook call',
    'Hooks can only be called inside',
    'multiple copies of React'
  ];
  
  return cacheRelatedErrors.some(pattern => 
    error.message?.includes(pattern) || error.stack?.includes(pattern)
  );
};
