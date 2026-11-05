import { useNetwork } from '@/contexts/NetworkContext';
import { Wifi, WifiOff, Signal, SignalLow } from 'lucide-react';

export function NetworkBadge() {
  const { isOnline, isSlow, connectionType, isNative } = useNetwork();
  
  // Show offline status
  if (!isOnline) {
    return (
      <span className="text-xs text-primary-foreground/90 flex items-center gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </span>
    );
  }
  
  // Show slow connection indicator
  if (isSlow) {
    return (
      <span className="text-xs text-primary-foreground/90 flex items-center gap-1">
        <SignalLow className="h-3 w-3" />
        Slow
      </span>
    );
  }
  
  // Show connection type on native
  if (isNative && connectionType !== 'unknown') {
    const icon = connectionType === 'wifi' ? (
      <Wifi className="h-3 w-3" />
    ) : (
      <Signal className="h-3 w-3" />
    );
    
    return (
      <span className="text-xs text-primary-foreground/90 flex items-center gap-1">
        {icon}
        {connectionType === 'wifi' ? 'WiFi' : connectionType.toUpperCase()}
      </span>
    );
  }
  
  // Default online status
  return (
    <span className="text-xs text-primary-foreground/90 flex items-center gap-1">
      <Wifi className="h-3 w-3" />
      Online
    </span>
  );
}