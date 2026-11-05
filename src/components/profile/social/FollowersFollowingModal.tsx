import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/ui/signed-image";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FollowersFollowingModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  defaultTab?: "followers" | "following";
  onUserClick?: (userId: string) => void;
}

interface ConnectionUser {
  id: string;
  full_name: string | null;
  profile_picture_url: string | null;
  isFollowing: boolean;
}

export function FollowersFollowingModal({ 
  userId, 
  open, 
  onClose, 
  defaultTab = "followers",
  onUserClick 
}: FollowersFollowingModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [followers, setFollowers] = useState<ConnectionUser[]>([]);
  const [following, setFollowing] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && userId) {
      setActiveTab(defaultTab);
      fetchConnections();
    }
  }, [open, userId, defaultTab]);

  const fetchConnections = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Get my following list
      if (user) {
        const { data: myFollowing } = await supabase
          .from("employee_connections")
          .select("following_id")
          .eq("follower_id", user.id);
        
        setMyFollowingIds(new Set(myFollowing?.map(f => f.following_id) || []));
      }

      // Get followers (people who follow this user)
      const { data: followersData } = await supabase
        .from("employee_connections")
        .select("follower_id")
        .eq("following_id", userId);

      // Get following (people this user follows)
      const { data: followingData } = await supabase
        .from("employee_connections")
        .select("following_id")
        .eq("follower_id", userId);

      // Fetch profiles for followers
      if (followersData && followersData.length > 0) {
        const followerIds = followersData.map(f => f.follower_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, profile_picture_url")
          .in("id", followerIds);

        setFollowers(
          (profiles || []).map(p => ({
            id: p.id,
            full_name: p.full_name,
            profile_picture_url: p.profile_picture_url,
            isFollowing: user ? myFollowingIds.has(p.id) || (followersData.some(f => f.follower_id === user.id) && followingData?.some(f => f.following_id === p.id)) : false
          }))
        );
      } else {
        setFollowers([]);
      }

      // Fetch profiles for following
      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, profile_picture_url")
          .in("id", followingIds);

        setFollowing(
          (profiles || []).map(p => ({
            id: p.id,
            full_name: p.full_name,
            profile_picture_url: p.profile_picture_url,
            isFollowing: user ? myFollowingIds.has(p.id) : false
          }))
        );
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    const isCurrentlyFollowing = myFollowingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from("employee_connections")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        
        setMyFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        toast.success("Unfollowed");
      } else {
        await supabase.from("employee_connections").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
        
        setMyFollowingIds(prev => new Set([...prev, targetUserId]));
        toast.success("Now following");
      }

      // Update local state
      setFollowers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u
      ));
      setFollowing(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u
      ));
    } catch (error) {
      toast.error("Failed to update follow status");
    }
  };

  const renderUserList = (users: ConnectionUser[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No connections yet
        </p>
      );
    }

    return (
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {users.map((u) => (
          <div 
            key={u.id} 
            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <button
              className="flex items-center gap-3 flex-1"
              onClick={() => {
                onUserClick?.(u.id);
              }}
            >
              <Avatar className="h-10 w-10">
                <SignedAvatarImage src={u.profile_picture_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {u.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">{u.full_name || "Unknown"}</span>
            </button>
            
            {user && u.id !== user.id && (
              <Button
                size="sm"
                variant={myFollowingIds.has(u.id) ? "outline" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow(u.id);
                }}
              >
                {myFollowingIds.has(u.id) ? (
                  <UserCheck className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "followers" | "following")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers">
              Followers ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following">
              Following ({following.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="followers" className="mt-4">
            {renderUserList(followers)}
          </TabsContent>
          
          <TabsContent value="following" className="mt-4">
            {renderUserList(following)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
