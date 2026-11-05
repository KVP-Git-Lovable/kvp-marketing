import { useEffect, useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';
import { offlineStorage } from '@/lib/offlineStorage';
import { toast } from '@/hooks/use-toast';
import { useManagedInterval } from '@/utils/intervalManager';

export function OfflineModeBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check sync queue with managed interval (pauses when hidden)
  const checkSyncQueue = useCallback(async () => {
    try {
      const queue = await offlineStorage.getSyncQueue();
      setSyncQueueCount(queue.length);
    } catch (error) {
      console.error('Error checking sync queue:', error);
    }
  }, []);

  useEffect(() => {
    checkSyncQueue();
  }, [checkSyncQueue]);

  useManagedInterval(
    'offline-banner-check',
    checkSyncQueue,
    10000, // Increased from 5s to 10s
    { runWhenHidden: false }
  );

  // Don't show if online and no pending syncs
  if (isOnline && syncQueueCount === 0) {
    return null;
  }
  
  // NOTE: We intentionally do NOT auto-delete pending sync items.
  // They may still be unsynced (e.g., poor connectivity, app in background).
  // Users can clear the queue manually using the X button once they confirm.


  const handleClearQueue = async () => {
    try {
      await offlineStorage.clearSyncQueue();
      setSyncQueueCount(0);
      toast({
        title: "Queue Cleared",
        description: "Sync queue has been cleared"
      });
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast({
        title: "Error",
        description: "Failed to clear sync queue",
        variant: "destructive"
      });
    }
  };

  return (
    <Alert 
      className={`mb-4 ${
        isOnline 
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30' 
          : 'bg-orange-50 border-orange-200 dark:bg-orange-950/30'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-blue-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-orange-600" />
          )}
          
          <AlertDescription className="text-sm font-medium">
            {isOnline ? (
              <span className="text-blue-700 dark:text-blue-300">Online</span>
            ) : (
              <span className="text-orange-700 dark:text-orange-300">Working Offline</span>
            )}
          </AlertDescription>
        </div>

        {syncQueueCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-2">
              <RefreshCw className="h-3 w-3" />
              {syncQueueCount} pending sync
            </Badge>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClearQueue}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Alert>
  );
}
