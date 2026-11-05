import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, X, RotateCw, Settings, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { requestCameraPermissionWithDetails, openAppSettings, checkCameraPermission } from '@/utils/permissions';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  title?: string;
  description?: string;
}

export const CameraCapture = ({ 
  isOpen, 
  onClose, 
  onCapture,
  title = "Capture Photo",
  description = "Position yourself in the frame and click capture"
}: CameraCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkAndRequestCamera();
    } else {
      stopCamera();
      setPermissionDenied(false);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  useEffect(() => {
    if (stream && videoRef.current && !isCheckingPermission) {
      console.log('Connecting stream to video element...');
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [stream, isCheckingPermission]);

  const checkAndRequestCamera = async () => {
    setIsCheckingPermission(true);
    setPermissionDenied(false);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available');
        toast.error('Camera not supported on this device/browser.');
        setIsCheckingPermission(false);
        onClose();
        return;
      }

      if (!Capacitor.isNativePlatform()) {
        console.log('PWA mode: Requesting camera access directly with facingMode:', facingMode);
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          console.log('PWA camera permission: granted, stream obtained with tracks:', mediaStream.getVideoTracks().length);
          setIsCheckingPermission(false);
          setPermissionDenied(false);
          setStream(mediaStream);
          return;
        } catch (error: any) {
          console.error('PWA camera access error:', error?.name, error?.message);
          
          if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
            setPermissionDenied(true);
            toast.error('Camera access denied. Please enable camera permission in browser settings.');
          } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
            toast.error('No camera found on this device.');
            onClose();
          } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
            toast.error('Camera is in use by another application.');
            onClose();
          } else if (error?.name === 'OverconstrainedError') {
            console.log('Retrying with basic video constraints...');
            try {
              const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
              setIsCheckingPermission(false);
              setPermissionDenied(false);
              setStream(basicStream);
              return;
            } catch (retryError) {
              console.error('Basic camera access also failed:', retryError);
              toast.error('Could not access camera.');
              onClose();
            }
          } else {
            toast.error('Could not access camera. Please check your device settings.');
            onClose();
          }
          setIsCheckingPermission(false);
          return;
        }
      }
      
      const currentStatus = await checkCameraPermission();
      
      if (currentStatus.granted) {
        await startCamera();
        return;
      }
      
      if (currentStatus.denied && !currentStatus.canAskAgain) {
        setPermissionDenied(true);
        setIsCheckingPermission(false);
        return;
      }
      
      const result = await requestCameraPermissionWithDetails();
      
      if (result.granted) {
        await startCamera();
      } else if (result.denied && !result.canAskAgain) {
        setPermissionDenied(true);
        toast.error('Camera permission denied. Please enable it in app settings.');
      } else {
        toast.error('Camera permission is required to take photos');
        onClose();
      }
    } catch (error) {
      console.error('Error checking camera permission:', error);
      await startCamera();
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const startCamera = async () => {
    try {
      console.log('Starting camera with facingMode:', facingMode);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      console.log('Camera stream obtained with', mediaStream.getVideoTracks().length, 'video tracks');
      setIsCheckingPermission(false);
      setPermissionDenied(false);
      setStream(mediaStream);
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        toast.error('Camera access denied. Please enable camera permission in settings.');
      } else {
        toast.error('Could not access camera. Please check your device.');
        onClose();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleOpenSettings = async () => {
    await openAppSettings();
    toast.info('Please enable camera permission in settings, then come back to the app.');
  };

  const handleRetryPermission = async () => {
    setPermissionDenied(false);
    await checkAndRequestCamera();
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      canvas.width = vw;
      canvas.height = vh;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, vw, vh);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            setCapturedBlob(blob);
            const imageUrl = URL.createObjectURL(blob);
            setCapturedImage(imageUrl);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              const resp = await fetch(dataUrl);
              const b = await resp.blob();
              setCapturedBlob(b);
              const imageUrl = URL.createObjectURL(b);
              setCapturedImage(imageUrl);
            } catch (e) {
              console.error('Failed to capture photo:', e);
              toast.error('Failed to capture photo. Please try again.');
            }
          }
          setIsCapturing(false);
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const retake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  const confirmCapture = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      handleClose();
      return;
    }
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onCapture(blob);
          handleClose();
        } else {
          toast.error('Could not process image. Please retake.');
        }
      }, 'image/jpeg', 0.95);
    } else {
      toast.error('Camera not ready. Please try again.');
    }
  };

  const handleClose = () => {
    stopCamera();
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setPermissionDenied(false);
    onClose();
  };

  // Permission denied view
  if (permissionDenied) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md bg-background border-border">
          <div className="flex flex-col items-center py-6 space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Camera Access Required</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                To capture photos, please grant camera access in your device settings.
              </p>
            </div>

            <div className="w-full space-y-3 px-4">
              {Capacitor.isNativePlatform() && (
                <Button 
                  onClick={handleOpenSettings}
                  className="w-full gap-2 h-12"
                  size="lg"
                >
                  <Settings className="h-5 w-5" />
                  Open Settings
                </Button>
              )}
              
              <Button 
                variant="outline"
                onClick={handleRetryPermission}
                className="w-full gap-2 h-12"
                size="lg"
              >
                <RefreshCw className="h-5 w-5" />
                Try Again
              </Button>
              
              <Button 
                variant="ghost"
                onClick={handleClose}
                className="w-full h-10"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-black border-0 sm:rounded-2xl [&>button]:hidden">
        {/* Header - compact to avoid overlapping circle */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 to-transparent p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-white drop-shadow-lg truncate">{title}</h2>
              <p className="text-xs text-white/80 drop-shadow-md truncate">{description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Camera Area */}
        <div className="relative w-full aspect-[3/4] sm:aspect-video bg-black">
          {isCheckingPermission ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/30 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white animate-pulse" />
                </div>
              </div>
              <p className="text-white/70 text-sm mt-4">Initializing camera...</p>
            </div>
          ) : !capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Modern face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Dark vignette overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
                
                {/* Face guide container */}
                <div className="relative flex flex-col items-center">
                  {/* Animated face guide */}
                  <div className="relative">
                    {/* Outer glow ring */}
                    <div className="absolute -inset-2 rounded-full border-2 border-white/20 animate-pulse" 
                         style={{ width: 'calc(100% + 16px)', height: 'calc(100% + 16px)' }} />
                    
                    {/* Main guide circle */}
                    <div className={cn(
                      "w-52 h-52 sm:w-60 sm:h-60 rounded-full border-[3px] transition-all duration-300",
                      stream ? "border-white/60" : "border-white/30"
                    )}>
                      {/* Corner markers for professional look */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary rounded-full" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary rounded-full" />
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-6 w-1 bg-primary rounded-full" />
                      <div className="absolute top-1/2 -right-1 -translate-y-1/2 h-6 w-1 bg-primary rounded-full" />
                    </div>
                  </div>
                  
                  {/* Instructions badge - positioned below circle */}
                  <div className="mt-4">
                    <div className="bg-black/70 backdrop-blur-sm px-4 py-1.5 rounded-full">
                      <p className="text-white text-xs font-medium">
                        {stream ? "Position face in circle" : "Starting camera..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-cover"
              />
            </>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pb-8">
          {!capturedImage ? (
            <div className="flex items-center justify-center gap-8">
              {/* Switch Camera Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleCamera}
                disabled={!stream}
                className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white disabled:opacity-50 backdrop-blur-sm"
              >
                <RotateCw className="h-6 w-6" />
              </Button>

              {/* Main Capture Button */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!stream || isCapturing}
                className={cn(
                  "relative h-20 w-20 rounded-full transition-all duration-200",
                  "focus:outline-none focus:ring-4 focus:ring-primary/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  !stream && "animate-pulse"
                )}
              >
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full border-4 border-white" />
                {/* Inner button */}
                <div className={cn(
                  "absolute inset-2 rounded-full bg-white transition-transform duration-150",
                  "hover:scale-95 active:scale-90",
                  isCapturing && "scale-90 bg-primary"
                )} />
                {isCapturing && (
                  <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping" />
                )}
              </button>

              {/* Empty placeholder to balance layout */}
              <div className="h-14 w-14" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={retake}
                size="lg"
                className="h-14 px-8 rounded-full bg-white/10 hover:bg-white/20 border-white/30 text-white"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Retake
              </Button>
              <Button
                type="button"
                onClick={confirmCapture}
                size="lg"
                className="h-14 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Check className="h-5 w-5 mr-2" />
                Use Photo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
