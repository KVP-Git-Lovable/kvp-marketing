/**
 * Native Network Service
 * Unified network detection for both web and native (Capacitor) platforms
 */

import { Capacitor } from '@capacitor/core';
import { Network, ConnectionStatus, ConnectionType } from '@capacitor/network';

export type NetworkConnectionType = 'wifi' | '4g' | '3g' | '2g' | 'cellular' | 'none' | 'unknown';

export interface NetworkStatus {
  connected: boolean;
  connectionType: NetworkConnectionType;
  isSlowConnection: boolean;
}

// Cache for network status
let cachedStatus: NetworkStatus | null = null;
let statusTimestamp = 0;
const STATUS_CACHE_DURATION = 5000; // 5 seconds

// Listeners
type NetworkListener = (status: NetworkStatus) => void;
const listeners: Set<NetworkListener> = new Set();

/**
 * Check if running in native Capacitor environment
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Map Capacitor connection type to our unified type
 */
const mapConnectionType = (type: ConnectionType): NetworkConnectionType => {
  switch (type) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'none':
      return 'none';
    case 'unknown':
    default:
      return 'unknown';
  }
};

/**
 * Determine if connection type is slow
 */
const isSlowConnectionType = (type: NetworkConnectionType): boolean => {
  // In native apps, cellular can be slow depending on signal
  // We'll treat unknown as potentially slow
  return type === '2g' || type === '3g' || type === 'none';
};

/**
 * Get network status from Capacitor Network plugin
 */
const getNativeNetworkStatus = async (): Promise<NetworkStatus> => {
  try {
    const status: ConnectionStatus = await Network.getStatus();
    const connectionType = mapConnectionType(status.connectionType);
    
    return {
      connected: status.connected,
      connectionType,
      isSlowConnection: isSlowConnectionType(connectionType),
    };
  } catch (error) {
    console.warn('Failed to get native network status, assuming online:', error);
    // CHANGED: Return connected=true on error to prevent false offline screens
    // The native network plugin may fail during app startup
    return {
      connected: true, // Optimistic default - assume online
      connectionType: 'unknown',
      isSlowConnection: false,
    };
  }
};

/**
 * Get network status from browser APIs
 */
const getBrowserNetworkStatus = (): NetworkStatus => {
  const isOnline = navigator.onLine;
  
  if (!isOnline) {
    return {
      connected: false,
      connectionType: 'none',
      isSlowConnection: true,
    };
  }
  
  // Try Network Information API
  if ('connection' in navigator && (navigator as any).connection) {
    const connection = (navigator as any).connection;
    const effectiveType = connection.effectiveType || 'unknown';
    
    let connectionType: NetworkConnectionType = 'unknown';
    if (effectiveType === '4g') connectionType = '4g';
    else if (effectiveType === '3g') connectionType = '3g';
    else if (effectiveType === '2g' || effectiveType === 'slow-2g') connectionType = '2g';
    
    return {
      connected: true,
      connectionType,
      isSlowConnection: effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g',
    };
  }
  
  // Fallback: assume online with unknown type
  return {
    connected: true,
    connectionType: 'unknown',
    isSlowConnection: false, // Optimistic default
  };
};

/**
 * Get current network status (works on both web and native)
 */
export const getNetworkStatus = async (): Promise<NetworkStatus> => {
  // Return cached status if fresh
  if (cachedStatus && Date.now() - statusTimestamp < STATUS_CACHE_DURATION) {
    return cachedStatus;
  }
  
  let status: NetworkStatus;
  
  if (isNativePlatform()) {
    status = await getNativeNetworkStatus();
  } else {
    status = getBrowserNetworkStatus();
  }
  
  // Cache the status
  cachedStatus = status;
  statusTimestamp = Date.now();
  
  return status;
};

/**
 * Get network status synchronously (uses cached value or browser state)
 */
export const getNetworkStatusSync = (): NetworkStatus => {
  if (cachedStatus && Date.now() - statusTimestamp < STATUS_CACHE_DURATION) {
    return cachedStatus;
  }
  
  // For sync calls, use browser status as fallback
  return getBrowserNetworkStatus();
};

/**
 * Add listener for network status changes
 */
export const addNetworkListener = (listener: NetworkListener): (() => void) => {
  listeners.add(listener);
  
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Notify all listeners of network status change
 */
const notifyListeners = (status: NetworkStatus) => {
  cachedStatus = status;
  statusTimestamp = Date.now();
  
  listeners.forEach(listener => {
    try {
      listener(status);
    } catch (error) {
      console.error('Network listener error:', error);
    }
  });
};

// Native network change listener handle
let nativeListenerHandle: { remove: () => Promise<void> } | null = null;

/**
 * Initialize native network listeners (call once at app startup)
 */
export const initializeNetworkListeners = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      // Remove existing listener if any
      if (nativeListenerHandle) {
        await nativeListenerHandle.remove();
      }
      
      // Add Capacitor Network listener
      nativeListenerHandle = await Network.addListener('networkStatusChange', (status) => {
        console.log('📶 Native network change:', status);
        
        const networkStatus: NetworkStatus = {
          connected: status.connected,
          connectionType: mapConnectionType(status.connectionType),
          isSlowConnection: isSlowConnectionType(mapConnectionType(status.connectionType)),
        };
        
        notifyListeners(networkStatus);
      });
      
      console.log('📶 Native network listeners initialized');
    } catch (error) {
      console.error('Failed to initialize native network listeners:', error);
    }
  } else {
    // Web: use browser events
    const handleOnline = () => {
      console.log('🌐 Browser online event');
      const status = getBrowserNetworkStatus();
      notifyListeners(status);
    };
    
    const handleOffline = () => {
      console.log('📴 Browser offline event');
      notifyListeners({
        connected: false,
        connectionType: 'none',
        isSlowConnection: true,
      });
    };
    
    const handleConnectionChange = () => {
      console.log('📶 Browser connection change');
      const status = getBrowserNetworkStatus();
      notifyListeners(status);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('connection' in navigator && (navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', handleConnectionChange);
    }
  }
};

/**
 * Clear cached network status
 */
export const clearNetworkCache = (): void => {
  cachedStatus = null;
  statusTimestamp = 0;
};
