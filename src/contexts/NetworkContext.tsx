import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getManualSlowMode, probeConnectionSpeed, clearSpeedCache } from '@/utils/internetSpeedCheck';
import { 
  getNetworkStatus, 
  addNetworkListener, 
  initializeNetworkListeners,
  isNativePlatform,
  NetworkStatus 
} from '@/utils/nativeNetworkService';
import { useManagedInterval } from '@/utils/intervalManager';

type ConnectionQuality = 'fast' | 'slow' | 'offline';
type EffectiveType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

interface NetworkState {
  isOnline: boolean;
  isSlow: boolean;
  connectionQuality: ConnectionQuality;
  effectiveType: EffectiveType;
  connectionType: string;
  shouldReduceData: boolean;
  lastChecked: Date | null;
  lastSyncTime: Date | null;
  isNative: boolean;
}

interface NetworkContextValue extends NetworkState {
  checkConnection: () => void;
  setManualOfflineMode: (offline: boolean) => void;
  manualOfflineMode: boolean;
  updateLastSyncTime: () => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

// Map connection type to effective type
function mapToEffectiveType(connectionType: string): EffectiveType {
  switch (connectionType) {
    case 'wifi':
    case '4g':
      return '4g';
    case '3g':
      return '3g';
    case '2g':
      return '2g';
    case 'cellular':
      return '4g'; // Assume decent cellular by default
    default:
      return 'unknown';
  }
}

// Determine connection quality
function determineQuality(
  connected: boolean, 
  connectionType: string, 
  hasSlowModeEnabled: boolean
): ConnectionQuality {
  if (!connected) return 'offline';
  if (hasSlowModeEnabled) return 'slow';
  
  switch (connectionType) {
    case '2g':
    case '3g':
    case 'none':
      return 'slow';
    case 'wifi':
    case '4g':
    case 'cellular':
      return 'fast';
    default:
      return 'fast'; // Optimistic default
  }
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [manualOfflineMode, setManualOfflineMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('lastSyncTime');
      return saved ? new Date(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [state, setState] = useState<NetworkState>(() => {
    // ALWAYS assume online initially to prevent false offline screens on startup
    // Some devices briefly report offline during app initialization
    // The actual network check will update this shortly after mount
    const slowModeEnabled = getManualSlowMode();
    
    return {
      isOnline: true, // Optimistic: assume online until proven otherwise
      isSlow: slowModeEnabled,
      connectionQuality: 'fast', // Optimistic default
      effectiveType: 'unknown',
      connectionType: 'unknown',
      shouldReduceData: slowModeEnabled,
      lastChecked: new Date(),
      lastSyncTime: null,
      isNative: isNativePlatform(),
    };
  });

  const mountedRef = useRef(true);

  const updateLastSyncTime = useCallback(() => {
    const now = new Date();
    setLastSyncTime(now);
    try {
      localStorage.setItem('lastSyncTime', now.toISOString());
    } catch {}
  }, []);

  const updateConnectionState = useCallback(async () => {
    if (!mountedRef.current) return;
    
    const slowModeEnabled = getManualSlowMode();
    
    try {
      // Get network status (works on both native and web)
      const networkStatus = await getNetworkStatus();
      
      const isOnline = networkStatus.connected && !manualOfflineMode;
      const quality = manualOfflineMode 
        ? 'offline' 
        : determineQuality(networkStatus.connected, networkStatus.connectionType, slowModeEnabled);
      
      setState(prev => ({
        isOnline,
        isSlow: quality === 'slow' || slowModeEnabled || networkStatus.isSlowConnection,
        connectionQuality: quality,
        effectiveType: mapToEffectiveType(networkStatus.connectionType),
        connectionType: networkStatus.connectionType,
        shouldReduceData: quality !== 'fast',
        lastChecked: new Date(),
        lastSyncTime: prev.lastSyncTime,
        isNative: isNativePlatform(),
      }));
    } catch (error) {
      console.error('Failed to get network status:', error);
      // Fallback to browser state
      const isOnline = navigator.onLine && !manualOfflineMode;
      setState(prev => ({
        isOnline,
        isSlow: slowModeEnabled,
        connectionQuality: isOnline ? 'fast' : 'offline',
        effectiveType: 'unknown',
        connectionType: 'unknown',
        shouldReduceData: !isOnline || slowModeEnabled,
        lastChecked: new Date(),
        lastSyncTime: prev.lastSyncTime,
        isNative: isNativePlatform(),
      }));
    }
  }, [manualOfflineMode]);

  const checkConnection = useCallback(() => {
    clearSpeedCache();
    updateConnectionState();
  }, [updateConnectionState]);

  // Initialize network listeners on mount
  useEffect(() => {
    mountedRef.current = true;
    
    // Initialize native/web listeners
    initializeNetworkListeners().catch(console.error);
    
    // Add listener for network changes
    const removeListener = addNetworkListener((status: NetworkStatus) => {
      if (!mountedRef.current) return;
      
      console.log('📶 Network status changed:', status);
      updateConnectionState();
    });
    
    // Initial status check
    updateConnectionState();

    return () => {
      mountedRef.current = false;
      removeListener();
    };
  }, [updateConnectionState]);

  // Use managed interval for periodic checks (pauses when app is hidden)
  // Less frequent on native since we have listeners
  const intervalMs = isNativePlatform() ? 120000 : 60000; // 2min native, 1min web (increased from 30s/60s)
  useManagedInterval(
    'network-context-check',
    updateConnectionState,
    intervalMs,
    { runWhenHidden: false }
  );

  // Update when manual mode changes
  useEffect(() => {
    updateConnectionState();
  }, [manualOfflineMode, updateConnectionState]);

  const value: NetworkContextValue = {
    ...state,
    lastSyncTime,
    checkConnection,
    setManualOfflineMode,
    manualOfflineMode,
    updateLastSyncTime,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    return {
      isOnline: navigator.onLine,
      isSlow: false,
      connectionQuality: navigator.onLine ? 'fast' : 'offline',
      effectiveType: 'unknown',
      connectionType: 'unknown',
      shouldReduceData: false,
      lastChecked: null,
      lastSyncTime: null,
      checkConnection: () => {},
      setManualOfflineMode: () => {},
      manualOfflineMode: false,
      updateLastSyncTime: () => {},
      isNative: isNativePlatform(),
    };
  }
  return context;
}
