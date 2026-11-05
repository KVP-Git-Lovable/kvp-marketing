import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CameraCapture } from './CameraCapture';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface ProfileSetupModalProps {
  userId: string;
  fullName: string;
  onComplete: () => void;
}

export const ProfileSetupModal = ({ userId, fullName, onComplete }: ProfileSetupModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const signedProfileUrl = useSignedUrl(profileImageUrl);

  useEffect(() => {
    const completed = localStorage.getItem('profileSetupComplete') === 'true';
    if (completed) {
      setNeedsProfileSetup(false);
      setIsOpen(false);
      return;
    }
    checkProfileSetup();
  }, [userId]);

  const checkProfileSetup = async () => {
    try {
      // Check if user has profile picture in profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_picture_url, onboarding_completed')
        .eq('id', userId)
        .single();

      const hasPicture = !!profile?.profile_picture_url;
      const completed = !!profile?.onboarding_completed;
      if (!hasPicture && !completed) {
        setNeedsProfileSetup(true);
        setIsOpen(true);
      } else {
        setProfileImageUrl(profile?.profile_picture_url ?? null);
        setNeedsProfileSetup(false);
        setIsOpen(false);
        localStorage.setItem('profileSetupComplete', 'true');
      }
    } catch (error) {
      console.error('Error checking profile setup:', error);
    }
  };

  const handleCapture = async (blob: Blob) => {
    setIsUploading(true);
    console.log('Starting photo upload...', { userId, blobSize: blob.size });
    
    try {
      // Upload to employee-photos bucket
      const fileName = `${userId}/baseline_${Date.now()}.jpg`;
      console.log('Uploading to:', fileName);
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, blob);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      console.log('Public URL:', urlData.publicUrl);

      // Update profiles table with profile picture
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: urlData.publicUrl, onboarding_completed: true })
        .eq('id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      console.log('Profile updated successfully');
      setProfileImageUrl(urlData.publicUrl);
      setUploadSuccess(true);
      setShowCamera(false);
      localStorage.setItem('profileSetupComplete', 'true');
      setNeedsProfileSetup(false);
      setIsOpen(false);
      onComplete();
      toast.success('Profile picture uploaded successfully!');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload profile picture');
      setShowCamera(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleComplete = async () => {
    if (!profileImageUrl) {
      toast.error('Please capture your profile picture before continuing');
      return;
    }
    
    console.log('Completing profile setup with image:', profileImageUrl);
    
    // Reload the profile to ensure fresh data
    await checkProfileSetup();
    setNeedsProfileSetup(false);
    setIsOpen(false);
    localStorage.setItem('profileSetupComplete', 'true');
    onComplete();
    toast.success('Profile setup completed! Welcome aboard!');
  };

  const handleSkip = () => {
    setNeedsProfileSetup(false);
    setIsOpen(false);
    toast.info('You can update your profile picture later from your profile page');
  };

  if (!needsProfileSetup) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open && !profileImageUrl) {
          // Allow closing only if user wants to skip
          handleSkip();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Profile</DialogTitle>
            <DialogDescription>
              Please capture your profile picture. This will be used for face verification during check-in.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            <Avatar className="w-32 h-32 border-4 border-border">
              <AvatarImage src={signedProfileUrl || undefined} />
              <AvatarFallback className="text-4xl">{fullName.charAt(0)}</AvatarFallback>
            </Avatar>

            {!profileImageUrl ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <Button 
                  onClick={() => setShowCamera(true)}
                  disabled={isUploading}
                  className="gap-2 w-full"
                >
                  <Camera className="w-4 h-4" />
                  {isUploading ? 'Uploading...' : 'Capture Profile Picture'}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  className="w-full"
                  disabled={isUploading}
                >
                  Skip for now
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Profile picture uploaded!</span>
                </div>
                <Button variant="outline" onClick={() => {
                  setProfileImageUrl(null);
                  setUploadSuccess(false);
                  setShowCamera(true);
                }} className="w-full">
                  Retake Photo
                </Button>
                <Button onClick={handleComplete} className="w-full">
                  Continue to Dashboard
                </Button>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Your profile picture will be verified by your manager and used for attendance verification.
          </p>
        </DialogContent>
      </Dialog>

      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCapture}
        title="Capture Profile Picture"
        description="Position your face in the center of the frame"
      />
    </>
  );
};
