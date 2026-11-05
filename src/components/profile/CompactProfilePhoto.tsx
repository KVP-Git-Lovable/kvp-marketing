import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

interface CompactProfilePhotoProps {
  userId: string;
  userProfile: any;
}

export function CompactProfilePhoto({ userId, userProfile }: CompactProfilePhotoProps) {
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedPhotoUrl = useSignedUrl(currentPhoto);

  useEffect(() => {
    if (userProfile?.profile_picture_url) {
      setCurrentPhoto(userProfile.profile_picture_url);
    }
  }, [userProfile]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please select an image smaller than 5MB.");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/profile_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_picture_url: urlData.publicUrl,
          onboarding_completed: true
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setCurrentPhoto(urlData.publicUrl);
      setUploadSuccess(true);
      toast.success("Profile picture updated!");
      
      // Reset success state after animation
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (error: any) {
      toast.error("Failed to upload photo: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative inline-block group">
      {/* Decorative glow on hover */}
      <div className={cn(
        "absolute -inset-1 rounded-full transition-all duration-300",
        "bg-gradient-to-br from-primary/20 to-primary/5 opacity-0 group-hover:opacity-100 blur-sm"
      )} />
      
      <Avatar className={cn(
        "relative w-20 h-20 ring-4 ring-background shadow-lg transition-transform duration-200",
        "group-hover:scale-105"
      )}>
        <AvatarImage 
          src={signedPhotoUrl || undefined} 
          alt="Profile" 
          className="object-cover"
        />
        <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
          {userProfile?.full_name?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
        disabled={isUploading}
      />
      
      <Button
        size="icon"
        variant="secondary"
        className={cn(
          "absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-lg transition-all duration-200",
          "bg-background hover:bg-primary hover:text-primary-foreground",
          "ring-2 ring-background",
          uploadSuccess && "bg-green-500 hover:bg-green-500 text-white"
        )}
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : uploadSuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
