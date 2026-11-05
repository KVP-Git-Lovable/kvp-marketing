/**
 * Memory Manager
 * 
 * Utility to help manage memory during prolonged app use.
 * Periodically clears stale caches and helps prevent memory bloat.
 */

import { offlineStorage } from '@/lib/offlineStorage';
import { clearRetailerIndex, buildRetailerIndex, getRetailerIndex } from '@/lib/retailerIndex';
import { cleanupOldSnapshots } from '@/lib/myVisitsSnapshot';

// Track when cleanup was last performed
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Perform periodic memory cleanup
 * Safe to call frequently - will only run cleanup if enough time has passed
 */
export function periodicMemoryCleanup(): void {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return; // Too soon since last cleanup
  }
  
  lastCleanupTime = now;
  
  try {
    // Clear memory cache in offline storage (forces re-read from Preferences next time)
    offlineStorage.clearMemoryCache();
    console.log('[MemoryManager] Cleared offline storage memory cache');
    
    // Clean old snapshots asynchronously
    cleanupOldSnapshots().catch(err => {
      console.warn('[MemoryManager] Error cleaning old snapshots:', err);
    });
  } catch (error) {
    console.warn('[MemoryManager] Error during cleanup:', error);
  }
}

/**
 * Rebuild retailer index with fresh data
 * Call this when retailer data changes significantly
 */
export async function rebuildRetailerIndexFromCache(): Promise<void> {
  try {
    const retailers = await offlineStorage.getAll<any>('retailers');
    if (retailers && retailers.length > 0) {
      buildRetailerIndex(retailers);
      console.log(`[MemoryManager] Rebuilt retailer index with ${retailers.length} items`);
    }
  } catch (error) {
    console.warn('[MemoryManager] Error rebuilding retailer index:', error);
  }
}

/**
 * Force full memory cleanup
 * Call this on page transitions or when app is backgrounded
 */
export function forceMemoryCleanup(): void {
  lastCleanupTime = 0;
  periodicMemoryCleanup();
  
  // Force garbage collection hint (if available in debug builds)
  if (typeof (window as any).gc === 'function') {
    try {
      (window as any).gc();
      console.log('[MemoryManager] Forced garbage collection');
    } catch (e) {
      // gc not available, ignore
    }
  }
}

/**
 * Get memory usage stats for debugging
 */
export function getMemoryStats(): { 
  retailerIndexSize: number;
  heapUsed?: number;
  heapTotal?: number;
} {
  const index = getRetailerIndex();
  const stats: any = {
    retailerIndexSize: index?.byId.size || 0
  };
  
  // Add performance memory info if available (Chrome only)
  if (typeof (performance as any).memory !== 'undefined') {
    stats.heapUsed = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
    stats.heapTotal = Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024);
  }
  
  return stats;
}

/**
 * Initialize memory pressure listener (Chrome only)
 * Triggers cleanup when browser signals memory pressure
 */
export function initMemoryPressureHandler(): void {
  // Listen for visibility change to cleanup when app is backgrounded
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      console.log('[MemoryManager] App backgrounded, triggering cleanup');
      forceMemoryCleanup();
    }
  });
  
  // Listen for page unload
  window.addEventListener('pagehide', () => {
    forceMemoryCleanup();
  });
  
  console.log('[MemoryManager] Memory pressure handlers initialized');
}
