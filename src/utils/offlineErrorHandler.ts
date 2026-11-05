/**
 * Global error handler for offline scenarios
 * Suppresses error toasts when the app is offline
 */

let isOnline = navigator.onLine;

// Update online status
window.addEventListener('online', () => {
  isOnline = true;
});

window.addEventListener('offline', () => {
  isOnline = false;
});

/**
 * Check if an error should be suppressed when offline
 */
export const shouldSuppressError = (error: any): boolean => {
  if (!isOnline) return true;
  
  // Suppress network errors when offline
  const networkErrors = [
    'Failed to fetch',
    'Network request failed',
    'NetworkError',
    'fetch failed',
    'Load failed',
  ];
  
  const errorMessage = error?.message || error?.toString() || '';
  return networkErrors.some(msg => errorMessage.includes(msg));
};

/**
 * Handle error with offline awareness
 */
export const handleError = (error: any, showToast?: (message: string) => void) => {
  if (shouldSuppressError(error)) {
    // Silent fail when offline - data will be available from cache/IndexedDB
    console.log('Offline mode: Error suppressed', error.message);
    return;
  }
  
  // Show error if online
  if (showToast && isOnline) {
    showToast(error.message || 'An error occurred');
  }
};
