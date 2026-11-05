import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, MapPin, HardDrive, Check, X, AlertCircle, Settings } from 'lucide-react';
import { requestAllPermissions, openAppSettings } from '@/utils/permissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Capacitor } from '@capacitor/core';

interface PermissionRequestModalProps {
  open: boolean;
  onComplete: () => void;
}

interface PermissionStatus {
  camera: boolean;
  location: boolean;
  storage: boolean;
}

export const PermissionRequestModal = ({ open, onComplete }: PermissionRequestModalProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    
    try {
      // This will trigger native Android/iOS permission dialogs
      const status = await requestAllPermissions();
      setPermissionStatus(status);
      setShowResults(true);
      // Mark that we've asked for permissions
      localStorage.setItem('permissions_requested', 'true');
    } catch (error) {
      console.error('Error requesting permissions:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContinue = () => {
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('permissions_requested', 'true');
    onComplete();
  };

  const handleOpenSettings = async () => {
    await openAppSettings();
  };

  const allGranted = permissionStatus && 
    permissionStatus.camera && 
    permissionStatus.location && 
    permissionStatus.storage;

  const anyDenied = permissionStatus && (
    !permissionStatus.camera || 
    !permissionStatus.location || 
    !permissionStatus.storage
  );

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>App Permissions</DialogTitle>
          <DialogDescription>
            To provide the best experience, this app needs access to:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!showResults ? (
            <>
              <PermissionItem
                icon={Camera}
                title="Camera"
                description="Take photos for attendance and visit check-ins"
              />
              <PermissionItem
                icon={MapPin}
                title="Location"
                description="Track visit locations and enable GPS features"
              />
              <PermissionItem
                icon={HardDrive}
                title="Storage"
                description="Store data locally for offline access and sync"
              />
              
              <div className="text-xs text-muted-foreground text-center pt-2">
                You'll see native permission dialogs from your device. Tap "Allow" on each to enable all features.
              </div>
            </>
          ) : (
            <>
              <PermissionResult
                icon={Camera}
                title="Camera"
                granted={permissionStatus?.camera || false}
              />
              <PermissionResult
                icon={MapPin}
                title="Location"
                granted={permissionStatus?.location || false}
              />
              <PermissionResult
                icon={HardDrive}
                title="Storage"
                granted={permissionStatus?.storage || false}
              />

              {anyDenied && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Some permissions were denied. You can still use the app, but some features may not work. 
                    {Capacitor.isNativePlatform() && ' Tap "Open Settings" to enable them manually.'}
                  </AlertDescription>
                </Alert>
              )}
              
              {allGranted && (
                <Alert className="mt-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    All permissions granted! You're all set to use the app.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!showResults ? (
            <>
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isRequesting}
              >
                Skip for Now
              </Button>
              <Button
                onClick={handleRequestPermissions}
                disabled={isRequesting}
              >
                {isRequesting ? 'Requesting...' : 'Grant Permissions'}
              </Button>
            </>
          ) : (
            <>
              {anyDenied && Capacitor.isNativePlatform() && (
                <Button 
                  variant="outline" 
                  onClick={handleOpenSettings}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Open Settings
                </Button>
              )}
              <Button onClick={handleContinue} className="flex-1">
                Continue to App
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PermissionItem = ({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: typeof Camera; 
  title: string; 
  description: string; 
}) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-primary/10 rounded-lg">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="flex-1">
      <h4 className="font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const PermissionResult = ({ 
  icon: Icon, 
  title, 
  granted 
}: { 
  icon: typeof Camera; 
  title: string; 
  granted: boolean; 
}) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 rounded-lg ${granted ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
      <Icon className={`h-5 w-5 ${granted ? 'text-green-600' : 'text-red-600'}`} />
    </div>
    <div className="flex-1">
      <h4 className="font-medium">{title}</h4>
    </div>
    {granted ? (
      <Check className="h-5 w-5 text-green-600" />
    ) : (
      <X className="h-5 w-5 text-red-600" />
    )}
  </div>
);
