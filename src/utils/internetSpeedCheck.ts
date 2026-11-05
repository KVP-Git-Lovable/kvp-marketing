/**
 * Utility to check internet connection speed
 * Uses Capacitor Network plugin for native apps, browser APIs for web
 * Returns estimated upload speed in Mbps
 */

import { getNetworkStatus, getNetworkStatusSync, isNativePlatform } from './nativeNetworkService';

// Cache the speed result to avoid repeated checks
let cachedSpeed: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Timeout-based detection cache
let probeResult: 'fast' | 'slow' | 'unknown' = 'unknown';
let probeTimestamp: number = 0;
const PROBE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Manual slow mode flag (user can force slow mode)
let manualSlowMode: boolean = false;

// Persist manual slow mode
const SLOW_MODE_KEY = 'manualSlowMode';
try {
  const saved = localStorage.getItem(SLOW_MODE_KEY);
  if (saved === 'true') manualSlowMode = true;
} catch {}

/**
 * Set manual slow mode - forces offline-first behavior
 */
export const setManualSlowMode = (enabled: boolean): void => {
  manualSlowMode = enabled;
  try {
    localStorage.setItem(SLOW_MODE_KEY, enabled ? 'true' : 'false');
  } catch {}
  console.log(`📶 Manual slow mode: ${enabled ? 'ON' : 'OFF'}`);
};

/**
 * Get manual slow mode status
 */
export const getManualSlowMode = (): boolean => manualSlowMode;

/**
 * Perform a quick timeout-based probe to detect slow connections
 * This is used as a fallback when Network Information API is unavailable
 * Skip probe on native platforms - use Capacitor Network plugin instead
 */
export const probeConnectionSpeed = async (): Promise<'fast' | 'slow'> => {
  // Return cached probe result if still valid
  if (probeResult !== 'unknown' && Date.now() - probeTimestamp < PROBE_CACHE_DURATION) {
    return probeResult;
  }

  // If manual slow mode is on, return slow
  if (manualSlowMode) {
    return 'slow';
  }

  // For native platforms, use Capacitor Network plugin instead of probe
  if (isNativePlatform()) {
    try {
      const status = await getNetworkStatus();
      probeResult = status.isSlowConnection ? 'slow' : 'fast';
      probeTimestamp = Date.now();
      console.log(`📶 Native network status: ${status.connectionType} -> ${probeResult}`);
      return probeResult;
    } catch (error) {
      console.log('📶 Native network check failed, assuming slow');
      return 'slow';
    }
  }

  // Web: use timeout-based probe
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const startTime = Date.now();
    await fetch('/ping.txt', { 
      method: 'HEAD', 
      cache: 'no-store',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    
    // If response took more than 2 seconds, consider it slow
    probeResult = responseTime > 2000 ? 'slow' : 'fast';
    probeTimestamp = Date.now();
    
    console.log(`📶 Connection probe: ${responseTime}ms -> ${probeResult}`);
    return probeResult;
  } catch (error) {
    // Timeout or network error = slow connection
    probeResult = 'slow';
    probeTimestamp = Date.now();
    console.log('📶 Connection probe: timeout/error -> slow');
    return 'slow';
  }
};

/**
 * Get connection speed - uses native plugin on mobile, browser APIs on web
 */
export const getConnectionSpeed = (): { 
  downlink: number; 
  effectiveType: string; 
  estimatedUpload: number;
  isSlowConnection: boolean;
} => {
  // Manual slow mode overrides everything
  if (manualSlowMode) {
    return {
      downlink: 0.1,
      effectiveType: 'slow-2g',
      estimatedUpload: 0.04,
      isSlowConnection: true,
    };
  }

  // Use sync network status (from cache or browser)
  const networkStatus = getNetworkStatusSync();
  
  if (!networkStatus.connected) {
    return {
      downlink: 0,
      effectiveType: 'none',
      estimatedUpload: 0,
      isSlowConnection: true,
    };
  }

  // Map connection type to speed estimates - more conservative for mobile
  const typeToSpeed: Record<string, { downlink: number; effectiveType: string }> = {
    'wifi': { downlink: 20, effectiveType: '4g' },
    '4g': { downlink: 8, effectiveType: '4g' },  // More conservative
    '3g': { downlink: 0.5, effectiveType: '3g' }, // More conservative - treated as slow
    '2g': { downlink: 0.1, effectiveType: '2g' },
    'cellular': { downlink: 3, effectiveType: '3g' }, // More conservative - assume 3g quality
    'unknown': { downlink: 2, effectiveType: '3g' }, // Unknown = assume slow
    'none': { downlink: 0, effectiveType: 'none' },
  };

  const speedInfo = typeToSpeed[networkStatus.connectionType] || typeToSpeed['unknown'];
  
  // Also check browser Network Information API for more detail
  if (!isNativePlatform() && 'connection' in navigator && (navigator as any).connection) {
    const connection = (navigator as any).connection;
    const downlink = connection.downlink || speedInfo.downlink;
    const effectiveType = connection.effectiveType || speedInfo.effectiveType;
    const estimatedUpload = downlink * 0.4;
    
    return {
      downlink,
      effectiveType,
      estimatedUpload,
      isSlowConnection: effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g' || downlink < 1,
    };
  }
  
  // Use mapped values
  return {
    downlink: speedInfo.downlink,
    effectiveType: speedInfo.effectiveType,
    estimatedUpload: speedInfo.downlink * 0.4,
    isSlowConnection: networkStatus.isSlowConnection,
  };
};

/**
 * Check upload speed - uses cached value if available
 * Non-blocking, returns immediately from Network Information API
 */
export const checkUploadSpeed = async (): Promise<number> => {
  // Return cached value if still valid
  if (cachedSpeed !== null && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedSpeed;
  }
  
  const { estimatedUpload } = getConnectionSpeed();
  
  // Cache the result
  cachedSpeed = estimatedUpload;
  cacheTimestamp = Date.now();
  
  console.log(`📶 Connection speed: ${estimatedUpload.toFixed(2)} Mbps (estimated upload)`);
  return estimatedUpload;
};

/**
 * Quick check if connection is slow
 * Instant, non-blocking
 */
export const isSlowConnection = (): boolean => {
  const { isSlowConnection } = getConnectionSpeed();
  return isSlowConnection;
};

/**
 * Get connection quality label - more aggressive slow detection
 */
export const getConnectionQuality = (): 'fast' | 'medium' | 'slow' | 'offline' => {
  // Manual slow mode = always slow
  if (manualSlowMode) return 'slow';
  
  const networkStatus = getNetworkStatusSync();
  
  if (!networkStatus.connected) return 'offline';
  
  const { effectiveType, downlink } = getConnectionSpeed();
  
  // More aggressive slow detection
  if (effectiveType === '2g' || effectiveType === 'slow-2g') return 'slow';
  if (effectiveType === '3g' || downlink < 2) return 'slow'; // 3g is now slow
  if (effectiveType === '4g' && downlink >= 5) return 'fast';
  if (effectiveType === 'wifi') return 'fast';
  return 'medium';
};

/**
 * Clear cached speed (useful after connection changes)
 */
export const clearSpeedCache = (): void => {
  cachedSpeed = null;
  cacheTimestamp = 0;
  probeResult = 'unknown';
  probeTimestamp = 0;
};
