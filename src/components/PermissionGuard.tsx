import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Camera, MapPin, HardDrive, AlertCircle, Settings } from 'lucide-react';
import { 
  requestCameraPermissionWithDetails, 
  requestLocationPermissionWithDetails, 
  requestStoragePermission,
  openAppSettings,
  checkCameraPermission,
  checkLocationPermission,
  checkStoragePermission
} from '@/utils/permissions';
import { Capacitor } from '@capacitor/core';

interface PermissionGuardProps {
  children: React.ReactNode;
  requireCamera?: boolean;
  requireLocation?: boolean;
  requireStorage?: boolean;
}

export const PermissionGuard = ({ 
  children, 
  requireCamera = false, 
  requireLocation = false,
  requireStorage = false 
}: PermissionGuardProps) => {
  const [permissions, setPermissions] = useState({
    camera: !requireCamera,
    location: !requireLocation,
    storage: !requireStorage
  });
  const [permanentlyDenied, setPermanentlyDenied] = useState({
    camera: false,
    location: false,
    storage: false
  });
  const [requesting, setRequesting] = useState(false);

  const checkAndRequestPermissions = async () => {
    setRequesting(true);
    const results = {
      camera: true,
      location: true,
      storage: true
    };
    const denied = {
      camera: false,
      location: false,
      storage: false
    };

    if (requireCamera) {
      const result = await requestCameraPermissionWithDetails();
      results.camera = result.granted;
      denied.camera = result.denied && !result.canAskAgain;
    }
    if (requireLocation) {
      const result = await requestLocationPermissionWithDetails();
      results.location = result.granted;
      denied.location = result.denied && !result.canAskAgain;
    }
    if (requireStorage) {
      results.storage = await requestStoragePermission();
    }

    setPermissions(results);
    setPermanentlyDenied(denied);
    setRequesting(false);
  };

  useEffect(() => {
    if (requireCamera || requireLocation || requireStorage) {
      checkAndRequestPermissions();
    }
  }, [requireCamera, requireLocation, requireStorage]);

  const handleOpenSettings = async () => {
    await openAppSettings();
  };

  const allGranted = permissions.camera && permissions.location && permissions.storage;
  const anyPermanentlyDenied = permanentlyDenied.camera || permanentlyDenied.location || permanentlyDenied.storage;

  if (!allGranted && !requesting) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Permissions Required</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            {requireCamera && !permissions.camera && (
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span>Camera access is required {permanentlyDenied.camera && '(denied)'}</span>
              </div>
            )}
            {requireLocation && !permissions.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Location access is required {permanentlyDenied.location && '(denied)'}</span>
              </div>
            )}
            {requireStorage && !permissions.storage && (
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Storage access is required {permanentlyDenied.storage && '(denied)'}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-4">
            {anyPermanentlyDenied && Capacitor.isNativePlatform() && (
              <Button 
                onClick={handleOpenSettings} 
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Open Settings
              </Button>
            )}
            <Button 
              onClick={checkAndRequestPermissions} 
              size="sm"
            >
              {anyPermanentlyDenied ? 'Check Again' : 'Grant Permissions'}
            </Button>
          </div>
          
          {anyPermanentlyDenied && (
            <p className="text-xs mt-3 opacity-80">
              Some permissions were permanently denied. Please enable them in your device settings.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (requesting) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Requesting permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
