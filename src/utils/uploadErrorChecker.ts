/**
 * Utility to check for recent upload errors in console logs
 */

// Store recent errors and upload attempts in memory
const recentErrors: Array<{ timestamp: number; message: string; type: string }> = [];
const uploadAttempts: Array<{ timestamp: number; success: boolean }> = [];
const MAX_ERROR_AGE = 5 * 60 * 1000; // 5 minutes

// Store original console.error to avoid infinite loop
let originalConsoleError: (...args: any[]) => void = console.error;

/**
 * Log an upload error
 */
export const logUploadError = (message: string, type: 'network' | 'server' | 'timeout' | 'other' = 'other') => {
  const error = {
    timestamp: Date.now(),
    message,
    type
  };
  recentErrors.push(error);
  
  // Keep only recent errors
  const cutoff = Date.now() - MAX_ERROR_AGE;
  while (recentErrors.length > 0 && recentErrors[0].timestamp < cutoff) {
    recentErrors.shift();
  }
  
  // Use original console.error to avoid infinite loop
  originalConsoleError(`[Upload Error - ${type}]`, message);
};

/**
 * Check if there are recent upload errors
 */
export const hasRecentUploadErrors = (): { hasErrors: boolean; errorCount: number; errors: string[] } => {
  // Clean up old errors
  const cutoff = Date.now() - MAX_ERROR_AGE;
  const validErrors = recentErrors.filter(err => err.timestamp >= cutoff);
  
  const uploadKeywords = ['upload', 'photo', 'image', 'file', 'network', 'timeout', 'server error', 'failed to fetch'];
  
  // Check for upload-related errors
  const uploadErrors = validErrors.filter(err => 
    uploadKeywords.some(keyword => err.message.toLowerCase().includes(keyword))
  );
  
  return {
    hasErrors: uploadErrors.length > 0,
    errorCount: uploadErrors.length,
    errors: uploadErrors.slice(-3).map(err => `[${err.type}] ${err.message}`)
  };
};

/**
 * Log an upload attempt
 */
export const logUploadAttempt = (success: boolean) => {
  const attempt = {
    timestamp: Date.now(),
    success
  };
  uploadAttempts.push(attempt);
  
  // Keep only recent attempts
  const cutoff = Date.now() - MAX_ERROR_AGE;
  while (uploadAttempts.length > 0 && uploadAttempts[0].timestamp < cutoff) {
    uploadAttempts.shift();
  }
};

/**
 * Check if there are recent upload attempts
 */
export const hasRecentUploadAttempts = (): boolean => {
  const cutoff = Date.now() - MAX_ERROR_AGE;
  const validAttempts = uploadAttempts.filter(attempt => attempt.timestamp >= cutoff);
  return validAttempts.length > 0;
};

/**
 * Clear all logged errors and attempts
 */
export const clearUploadErrors = () => {
  recentErrors.length = 0;
  uploadAttempts.length = 0;
};

// Intercept console errors to catch upload issues
if (typeof window !== 'undefined') {
  originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');
    
    // Check if this is an upload-related error (but not RLS or transaction errors)
    const uploadKeywords = ['upload', 'photo', 'image', 'file'];
    const excludeKeywords = ['read-only transaction', 'RLS', 'INSERT in'];
    
    const isUploadError = uploadKeywords.some(keyword => message.toLowerCase().includes(keyword));
    const isExcluded = excludeKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    if (isUploadError && !isExcluded) {
      let errorType: 'network' | 'server' | 'timeout' | 'other' = 'other';
      
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('failed to fetch')) {
        errorType = 'network';
      } else if (message.toLowerCase().includes('timeout')) {
        errorType = 'timeout';
      } else if (message.toLowerCase().includes('server') || message.toLowerCase().includes('500')) {
        errorType = 'server';
      }
      
      logUploadError(message, errorType);
    }
    
    originalConsoleError.apply(console, args);
  };
}
