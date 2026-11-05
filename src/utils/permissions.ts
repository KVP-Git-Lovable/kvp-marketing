import { Camera, CameraResultType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export type PermissionResult = {
  granted: boolean;
  denied: boolean;
  canAskAgain: boolean;
};

/**
 * Open the app settings page on the device
 */
export const openAppSettings = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Dynamic import to avoid issues in web
      const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings');
      
      if (Capacitor.getPlatform() === 'android') {
        await NativeSettings.openAndroid({
          option: AndroidSettings.ApplicationDetails,
        });
      } else if (Capacitor.getPlatform() === 'ios') {
        await NativeSettings.openIOS({
          option: IOSSettings.App,
        });
      }
    } else {
      // Web: Show a message that user needs to enable in browser settings
      console.log('Please enable permissions in your browser settings');
    }
  } catch (error) {
    console.error('Error opening app settings:', error);
  }
};

/**
 * Check camera permission status
 */
export const checkCameraPermission = async (): Promise<PermissionResult> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Camera.checkPermissions();
      const status = result.camera;
      
      return {
        granted: status === 'granted',
        denied: status === 'denied',
        canAskAgain: status === 'prompt' || status === 'prompt-with-rationale',
      };
    } else {
      // Web: Check via Permissions API
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          return {
            granted: status.state === 'granted',
            denied: status.state === 'denied',
            canAskAgain: status.state === 'prompt',
          };
        } catch {
          return { granted: false, denied: false, canAskAgain: true };
        }
      }
      return { granted: false, denied: false, canAskAgain: true };
    }
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return { granted: false, denied: false, canAskAgain: true };
  }
};

/**
 * Request camera permission (works in both web and native)
 * Returns detailed result about permission status
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    // First check current status
    const currentStatus = await checkCameraPermission();
    
    // If already granted, return true
    if (currentStatus.granted) {
      console.log('Camera permission already granted');
      return true;
    }
    
    // If denied and can't ask again (permanently denied), we need to redirect to settings
    if (currentStatus.denied && !currentStatus.canAskAgain) {
      console.log('Camera permission permanently denied - user must enable in settings');
      return false;
    }
    
    if (Capacitor.isNativePlatform()) {
      // Request permission - this will show native Android/iOS dialog
      const result = await Camera.requestPermissions();
      const granted = result.camera === 'granted';
      console.log('Native camera permission:', granted ? 'granted' : 'denied');
      return granted;
    } else {
      // Web: Request camera access via getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        // Stop the stream immediately, we just needed to check permission
        stream.getTracks().forEach(track => track.stop());
        console.log('Web camera permission: granted');
        return true;
      } catch (error) {
        console.error('Web camera permission denied:', error);
        return false;
      }
    }
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
};

/**
 * Request camera permission with detailed result
 */
export const requestCameraPermissionWithDetails = async (): Promise<PermissionResult> => {
  try {
    // First check current status
    const currentStatus = await checkCameraPermission();
    
    // If already granted, return immediately
    if (currentStatus.granted) {
      return { granted: true, denied: false, canAskAgain: false };
    }
    
    // If permanently denied, return denied
    if (currentStatus.denied && !currentStatus.canAskAgain) {
      return { granted: false, denied: true, canAskAgain: false };
    }
    
    if (Capacitor.isNativePlatform()) {
      const result = await Camera.requestPermissions();
      const granted = result.camera === 'granted';
      const denied = result.camera === 'denied';
      
      // After requesting, check if we can ask again
      const newStatus = await checkCameraPermission();
      
      return {
        granted,
        denied,
        canAskAgain: newStatus.canAskAgain,
      };
    } else {
      // Web
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        stream.getTracks().forEach(track => track.stop());
        return { granted: true, denied: false, canAskAgain: false };
      } catch (error: any) {
        const isDenied = error?.name === 'NotAllowedError';
        return { 
          granted: false, 
          denied: isDenied, 
          canAskAgain: !isDenied 
        };
      }
    }
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return { granted: false, denied: false, canAskAgain: true };
  }
};

/**
 * Check location permission status
 */
export const checkLocationPermission = async (): Promise<PermissionResult> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Geolocation.checkPermissions();
      const status = result.location;
      
      return {
        granted: status === 'granted',
        denied: status === 'denied',
        canAskAgain: status === 'prompt' || status === 'prompt-with-rationale',
      };
    } else {
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          return {
            granted: status.state === 'granted',
            denied: status.state === 'denied',
            canAskAgain: status.state === 'prompt',
          };
        } catch {
          return { granted: false, denied: false, canAskAgain: true };
        }
      }
      return { granted: false, denied: false, canAskAgain: true };
    }
  } catch (error) {
    console.error('Error checking location permission:', error);
    return { granted: false, denied: false, canAskAgain: true };
  }
};

/**
 * Request location permission (works in both web and native)
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const currentStatus = await checkLocationPermission();
    
    if (currentStatus.granted) {
      console.log('Location permission already granted');
      return true;
    }
    
    if (currentStatus.denied && !currentStatus.canAskAgain) {
      console.log('Location permission permanently denied');
      return false;
    }
    
    if (Capacitor.isNativePlatform()) {
      const result = await Geolocation.requestPermissions();
      const granted = result.location === 'granted';
      console.log('Native location permission:', granted ? 'granted' : 'denied');
      return granted;
    } else {
      // Web: Request location via getCurrentPosition
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          console.log('Geolocation not supported');
          resolve(false);
          return;
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Web location permission: granted');
            resolve(true);
          },
          (error) => {
            console.error('Web location permission denied:', error);
            resolve(false);
          },
          { timeout: 10000 }
        );
      });
    }
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

/**
 * Request location permission with detailed result
 */
export const requestLocationPermissionWithDetails = async (): Promise<PermissionResult> => {
  try {
    const currentStatus = await checkLocationPermission();
    
    if (currentStatus.granted) {
      return { granted: true, denied: false, canAskAgain: false };
    }
    
    if (currentStatus.denied && !currentStatus.canAskAgain) {
      return { granted: false, denied: true, canAskAgain: false };
    }
    
    if (Capacitor.isNativePlatform()) {
      const result = await Geolocation.requestPermissions();
      const granted = result.location === 'granted';
      const denied = result.location === 'denied';
      const newStatus = await checkLocationPermission();
      
      return {
        granted,
        denied,
        canAskAgain: newStatus.canAskAgain,
      };
    } else {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ granted: false, denied: false, canAskAgain: true });
          return;
        }
        
        navigator.geolocation.getCurrentPosition(
          () => {
            resolve({ granted: true, denied: false, canAskAgain: false });
          },
          (error) => {
            const isDenied = error.code === error.PERMISSION_DENIED;
            resolve({ 
              granted: false, 
              denied: isDenied, 
              canAskAgain: !isDenied 
            });
          },
          { timeout: 10000 }
        );
      });
    }
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return { granted: false, denied: false, canAskAgain: true };
  }
};

/**
 * Check storage permission status
 */
export const checkStoragePermission = async (): Promise<PermissionResult> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.checkPermissions();
      const status = result.publicStorage;
      
      return {
        granted: status === 'granted',
        denied: status === 'denied',
        canAskAgain: status === 'prompt' || status === 'prompt-with-rationale',
      };
    } else {
      // Web always has storage
      return { granted: true, denied: false, canAskAgain: false };
    }
  } catch (error) {
    console.error('Error checking storage permission:', error);
    return { granted: true, denied: false, canAskAgain: false };
  }
};

/**
 * Request storage permission (native only, web always has storage)
 */
export const requestStoragePermission = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const currentStatus = await checkStoragePermission();
      
      if (currentStatus.granted) {
        return true;
      }
      
      if (currentStatus.denied && !currentStatus.canAskAgain) {
        return false;
      }
      
      const result = await Filesystem.requestPermissions();
      const granted = result.publicStorage === 'granted';
      console.log('Native storage permission:', granted ? 'granted' : 'denied');
      return granted;
    } else {
      // Web always has localStorage/IndexedDB
      console.log('Web storage: always available');
      return true;
    }
  } catch (error) {
    console.error('Error requesting storage permission:', error);
    return false;
  }
};

/**
 * Request all permissions at once
 */
export const requestAllPermissions = async () => {
  console.log('Requesting all permissions...');
  
  const camera = await requestCameraPermission();
  const location = await requestLocationPermission();
  const storage = await requestStoragePermission();

  const result = { camera, location, storage };
  console.log('All permissions result:', result);
  
  return result;
};

/**
 * Check if permissions are already granted
 */
export const checkPermissions = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const cameraPermission = await Camera.checkPermissions();
      const locationPermission = await Geolocation.checkPermissions();
      const storagePermission = await Filesystem.checkPermissions();

      return {
        camera: cameraPermission.camera === 'granted',
        location: locationPermission.location === 'granted',
        storage: storagePermission.publicStorage === 'granted'
      };
    } else {
      // Web: Check via Permissions API if available
      if (navigator.permissions) {
        try {
          const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const locationStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          
          return {
            camera: cameraStatus.state === 'granted',
            location: locationStatus.state === 'granted',
            storage: true // Always available in web
          };
        } catch (error) {
          console.log('Permissions API not fully supported, returning optimistic defaults');
          return { camera: true, location: true, storage: true };
        }
      }
      
      // Fallback: assume permissions need to be requested
      return { camera: false, location: false, storage: true };
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    return { camera: false, location: false, storage: true };
  }
};
