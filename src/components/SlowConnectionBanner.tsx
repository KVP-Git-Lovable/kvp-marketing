import { useNetwork } from '@/contexts/NetworkContext';
import { Wifi, WifiOff, AlertTriangle, Zap, Signal, SignalLow } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { setManualSlowMode, getManualSlowMode } from '@/utils/internetSpeedCheck';

export function SlowConnectionBanner() {
  const { isOnline, isSlow, connectionType, isNative, manualOfflineMode, setManualOfflineMode } = useNetwork();
  const [expanded, setExpanded] = useState(false);
  const [slowModeEnabled, setSlowModeEnabled] = useState(getManualSlowMode());

  const isOffline = !isOnline || manualOfflineMode;
  const isSlowMode = slowModeEnabled && !isOffline;
  
  // ONLY show if: slow connection (not offline) OR manual offline mode OR slow mode enabled
  // Do NOT show when simply offline - user doesn't want the red notification
  const shouldShow = (isSlow && isOnline && !manualOfflineMode) || manualOfflineMode || slowModeEnabled;
  
  if (!shouldShow) {
    return null;
  }

  const handleToggleSlowMode = () => {
    const newValue = !slowModeEnabled;
    setSlowModeEnabled(newValue);
    setManualSlowMode(newValue);
  };

  // Determine display state priority: offline > slow mode > slow connection
  const getDisplayState = () => {
    if (isOffline) return 'offline';
    if (isSlowMode) return 'slowMode';
    if (isSlow) return 'slow';
    return 'normal';
  };

  const displayState = getDisplayState();

  // Get connection label for native apps
  const getConnectionLabel = (): string => {
    if (isNative && connectionType && connectionType !== 'unknown') {
      if (connectionType === 'wifi') return 'WiFi';
      if (connectionType === 'cellular') return 'Cellular';
      return connectionType.toUpperCase();
    }
    return '';
  };

  const connectionLabel = getConnectionLabel();

  return (
    <div className="fixed bottom-20 right-4 z-[200]">
      {/* Small floating indicator */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all",
          displayState === 'offline' && "bg-destructive text-destructive-foreground",
          displayState === 'slowMode' && "bg-primary text-primary-foreground",
          displayState === 'slow' && "bg-warning text-warning-foreground"
        )}
        aria-label={
          displayState === 'offline' ? "Offline" : 
          displayState === 'slowMode' ? "Slow Mode Active" : 
          "Slow connection"
        }
      >
        {displayState === 'offline' ? (
          <WifiOff className="h-5 w-5" />
        ) : displayState === 'slowMode' ? (
          <Zap className="h-5 w-5" />
        ) : isNative ? (
          <SignalLow className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
      </button>

      {/* Expanded tooltip */}
      {expanded && (
        <div 
          className={cn(
            "absolute bottom-12 right-0 w-60 p-3 rounded-lg shadow-xl text-xs animate-in fade-in slide-in-from-bottom-2 duration-200",
            displayState === 'offline' && "bg-destructive text-destructive-foreground",
            displayState === 'slowMode' && "bg-primary text-primary-foreground",
            displayState === 'slow' && "bg-warning text-warning-foreground"
          )}
        >
          <div className="font-medium mb-1 flex items-center gap-2">
            {displayState === 'offline' 
              ? (manualOfflineMode ? 'Manual Offline' : 'No Internet')
              : displayState === 'slowMode'
              ? 'Slow Mode Active'
              : 'Slow Connection'}
            {connectionLabel && (
              <span className="text-[10px] px-1.5 py-0.5 bg-background/20 rounded">
                {connectionLabel}
              </span>
            )}
          </div>
          <div className="opacity-80 mb-2">
            {displayState === 'offline' 
              ? 'Using cached data' 
              : displayState === 'slowMode'
              ? 'Loading from cache first'
              : isNative
              ? 'Network is slow, using cached data'
              : 'Some features may be delayed'}
          </div>
          
          <div className="flex flex-col gap-2">
            {/* Slow Mode Toggle */}
            {!isOffline && (
              <button
                onClick={handleToggleSlowMode}
                className={cn(
                  "text-xs px-2 py-1.5 rounded transition-all flex items-center gap-1",
                  slowModeEnabled 
                    ? "bg-background/20 hover:bg-background/30" 
                    : "bg-background/10 hover:bg-background/20"
                )}
              >
                {slowModeEnabled ? (
                  <>
                    <Zap className="h-3 w-3" />
                    Disable Slow Mode
                  </>
                ) : (
                  <>
                    <SignalLow className="h-3 w-3" />
                    Enable Slow Mode
                  </>
                )}
              </button>
            )}
            
            {/* Offline Toggle */}
            {manualOfflineMode ? (
              <button
                onClick={() => {
                  setManualOfflineMode(false);
                  setExpanded(false);
                }}
                className="text-xs underline opacity-80 hover:opacity-100 flex items-center gap-1"
              >
                <Wifi className="h-3 w-3" />
                Go online
              </button>
            ) : !isOffline ? (
              <button
                onClick={() => {
                  setManualOfflineMode(true);
                  setExpanded(false);
                }}
                className="text-xs underline opacity-80 hover:opacity-100 flex items-center gap-1"
              >
                <WifiOff className="h-3 w-3" />
                Work fully offline
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for use in headers/status bars
export function ConnectionStatusIndicator() {
  const { isOnline, isSlow, connectionType, isNative, manualOfflineMode } = useNetwork();
  const slowModeEnabled = getManualSlowMode();

  if (isOnline && !isSlow && !manualOfflineMode && !slowModeEnabled) {
    return null;
  }

  const isOffline = !isOnline || manualOfflineMode;

  // Get connection type label for native
  const getTypeLabel = (): string | null => {
    if (!isNative || !connectionType || connectionType === 'unknown') return null;
    if (connectionType === 'wifi') return 'WiFi';
    if (connectionType === 'cellular') return 'Cell';
    return connectionType.toUpperCase();
  };

  const typeLabel = getTypeLabel();

  return (
    <div 
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        isOffline 
          ? "bg-destructive/20 text-destructive" 
          : slowModeEnabled
          ? "bg-primary/20 text-primary"
          : "bg-warning/20 text-warning"
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : slowModeEnabled ? (
        <>
          <Zap className="h-3 w-3" />
          <span>Slow Mode</span>
        </>
      ) : (
        <>
          {isNative ? <SignalLow className="h-3 w-3" /> : <Signal className="h-3 w-3" />}
          <span>Slow{typeLabel ? ` (${typeLabel})` : ''}</span>
        </>
      )}
    </div>
  );
}
