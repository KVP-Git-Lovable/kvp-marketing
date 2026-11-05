import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl?: string;
  userName?: string;
}

const UserPhotoDialog: React.FC<UserPhotoDialogProps> = ({
  open,
  onOpenChange,
  photoUrl,
  userName = 'User',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-border sm:rounded-2xl">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background pt-12 pb-6">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-10 w-10 rounded-full bg-background/80 hover:bg-background shadow-sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Photo container */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Decorative ring */}
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 blur-sm" />
              
              {photoUrl ? (
                <div className="relative w-48 h-48 rounded-full overflow-hidden ring-4 ring-background shadow-xl">
                  <img
                    src={photoUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <Avatar className="relative w-48 h-48 ring-4 ring-background shadow-xl">
                  <AvatarImage src={photoUrl} />
                  <AvatarFallback className="text-5xl bg-muted">
                    {userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Status indicator */}
              <div className={cn(
                "absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center",
                "ring-4 ring-background",
                photoUrl ? "bg-green-500" : "bg-muted"
              )}>
                {photoUrl ? (
                  <div className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  <User className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="p-6 pt-4 text-center space-y-2">
          <h3 className="text-xl font-semibold text-foreground">{userName}</h3>
          {!photoUrl && (
            <p className="text-sm text-muted-foreground">No profile photo available</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserPhotoDialog;
