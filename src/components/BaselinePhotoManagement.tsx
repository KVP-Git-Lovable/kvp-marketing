import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Upload, User, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";

interface BaselinePhotoManagementProps {
  userId: string;
  userProfile: any;
}

export const BaselinePhotoManagement = ({ userId, userProfile }: BaselinePhotoManagementProps) => {
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedPhotoUrl = useSignedUrl(currentPhoto);

  useEffect(() => {
    fetchCurrentPhoto();
  }, [userId]);

  const fetchCurrentPhoto = async () => {
    try {
      // Fetch profile picture from profiles table
      const { data } = await supabase
        .from('profiles')
        .select('profile_picture_url')
        .eq('id', userId)
        .single();

      if (data?.profile_picture_url) {
        setCurrentPhoto(data.profile_picture_url);
      }
    } catch (error) {
      console.error('Error fetching current photo:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/baseline_photo_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      // Update profiles table with the profile picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_picture_url: urlData.publicUrl,
          onboarding_completed: true
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setCurrentPhoto(urlData.publicUrl);
      setIsOpen(false);
      
      toast({
        title: "Success",
        description: "Profile picture updated successfully.",
      });

    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User size={20} />
          Profile Picture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Avatar className="w-32 h-32">
            <AvatarImage src={signedPhotoUrl || undefined} alt="Baseline photo" />
            <AvatarFallback className="text-2xl">
              {userProfile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            {userProfile?.full_name || 'User'}
          </p>
          <p className="text-xs text-gray-500">
            This photo is used for your profile and face verification during attendance
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Camera size={16} className="mr-2" />
              {currentPhoto ? 'Update Photo' : 'Upload Photo'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Upload Profile Picture</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Select a clear, front-facing photo for accurate face verification.
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="photo-upload">Choose Photo</Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  disabled={isUploading}
                />
              </div>

              <div className="text-xs text-gray-500">
                • Use a clear, well-lit photo
                • Face should be clearly visible
                • Maximum file size: 5MB
                • Supported formats: JPG, PNG, GIF
              </div>

              {isUploading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {currentPhoto && (
          <div className="text-xs text-center text-muted-foreground mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};