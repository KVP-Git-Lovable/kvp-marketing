import { useNetwork } from '@/contexts/NetworkContext';
import { Database, Clock, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { getManualSlowMode } from '@/utils/internetSpeedCheck';

interface CacheStatusIndicatorProps {
  className?: string;
  showLastSync?: boolean;
}

export function CacheStatusIndicator({ className, showLastSync = true }: CacheStatusIndicatorProps) {
  const { isOnline, isSlow, manualOfflineMode, lastSyncTime } = useNetwork();
  const isSlowMode = getManualSlowMode();
  
  const isUsingCache = !isOnline || isSlow || manualOfflineMode || isSlowMode;
  
  if (!isUsingCache) {
    return null;
  }

  const getStatusInfo = () => {
    if (manualOfflineMode || !isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
      };
    }
    if (isSlowMode) {
      return {
        icon: Zap,
        label: 'Slow Mode',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      };
    }
    return {
      icon: Database,
      label: 'Using Cache',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    };
  };

  const { icon: Icon, label, color, bgColor } = getStatusInfo();

  const lastSyncText = lastSyncTime 
    ? `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
    : 'Not synced yet';

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        bgColor, color
      )}>
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      
      {showLastSync && lastSyncTime && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{lastSyncText}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for headers - just shows an icon with tooltip
 */
export function CacheStatusBadge({ className }: { className?: string }) {
  const { isOnline, isSlow, manualOfflineMode, lastSyncTime } = useNetwork();
  const isSlowMode = getManualSlowMode();
  
  const isUsingCache = !isOnline || isSlow || manualOfflineMode || isSlowMode;
  
  if (!isUsingCache) {
    return null;
  }

  const lastSyncText = lastSyncTime 
    ? formatDistanceToNow(lastSyncTime, { addSuffix: true })
    : 'Never';

  return (
    <div 
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        manualOfflineMode || !isOnline 
          ? "bg-destructive/20 text-destructive" 
          : isSlowMode
          ? "bg-primary/20 text-primary"
          : "bg-warning/20 text-warning",
        className
      )}
      title={`Using cached data. Last sync: ${lastSyncText}`}
    >
      {manualOfflineMode || !isOnline ? (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : isSlowMode ? (
        <>
          <Zap className="h-3 w-3" />
          <span>Slow</span>
        </>
      ) : (
        <>
          <Database className="h-3 w-3" />
          <span>Cache</span>
        </>
      )}
    </div>
  );
}